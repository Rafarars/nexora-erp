import { describe, expect, it } from 'vitest';
import {
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PaymentExceedsBalanceError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  PayableSupplierNotFoundError,
  PayableInvoiceNotFoundError,
} from '../domain/errors/payables.errors.js';
import { DOLLARS, INVOICE, OTHER_INVOICE, OTHER_SUPPLIER, SUPPLIER, TENANT_A, TENANT_B } from '../domain/testing/payables.mother.js';
import { PaymentRequest } from './create-payment/payment-creator.js';
import { PayablesScenario, aPayablesScenario } from './testing/payables-scenario.js';

const FOREIGN_INVOICE = 'f9999999-9999-4999-8999-999999999999';
const THIRD_INVOICE = 'f3333333-3333-4333-8333-333333333333';

function world(): PayablesScenario {
  const s = aPayablesScenario();

  s.store.supplier(TENANT_A, { id: SUPPLIER, code: 'PRV000001', name: 'Distribuidora Delta', paymentTermDays: 15, isActive: true });
  s.store.supplier(TENANT_A, { id: OTHER_SUPPLIER, code: 'PRV000002', name: 'Suministros Omega', paymentTermDays: 0, isActive: false });
  s.store.invoice(TENANT_A, { id: INVOICE, code: 'FCP000002', supplierId: SUPPLIER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'confirmed', total: 100, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FCP000001', supplierId: SUPPLIER, issueDate: '2025-12-26', dueDate: '2026-01-10', status: 'confirmed', total: 50, ...DOLLARS });
  s.store.invoice(TENANT_A, { id: THIRD_INVOICE, code: 'FCP000003', supplierId: OTHER_SUPPLIER, issueDate: '2026-01-14', dueDate: '2026-01-14', status: 'confirmed', total: 30, ...DOLLARS });
  s.store.invoice(TENANT_B, { id: FOREIGN_INVOICE, code: 'FCP000001', supplierId: 'e8999999-9999-4999-8999-999999999999', issueDate: '2026-01-05', dueDate: '2026-01-05', status: 'confirmed', total: 10, ...DOLLARS });

  return s;
}

const request = (allocations: PaymentRequest['allocations'], overrides: Partial<PaymentRequest> = {}): PaymentRequest => ({
  tenantId: TENANT_A,
  supplierId: SUPPLIER,
  method: 'transfer',
  reference: 'TRF-1',
  allocations,
  ...overrides,
});

const payments = async (s: PayablesScenario) => (await s.searchPayments.run({ tenantId: TENANT_A })).payments;
const latest = async (s: PayablesScenario) => (await payments(s))[0];

async function confirmed(s: PayablesScenario, allocations: PaymentRequest['allocations'], overrides: Partial<PaymentRequest> = {}) {
  await s.createPayment.run(request(allocations, overrides));
  const payment = await latest(s);
  await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: payment.id });
  return payment;
}

describe('payables cycle', () => {
  it('registers a draft that touches no balance until it is confirmed', async () => {
    const s = world();

    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 40 }]));

    const draft = await latest(s);
    expect(draft.status).toBe('draft');
    expect(draft.amount).toBe(40);

    // En borrador, el saldo sigue siendo 100
    const invBefore = (await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] }))[0];
    expect(invBefore.balance()).toBe(100);

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: draft.id });

    const confirmedPayment = await latest(s);
    expect(confirmedPayment.status).toBe('confirmed');

    // Confirmado, el saldo baja a 60
    const invAfter = (await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] }))[0];
    expect(invAfter.balance()).toBe(60);
  });

  it('rejects a payment that exceeds the balance of an invoice', async () => {
    const s = world();

    // Factura tiene total 100. Intentar pagar 100.01 en borrador ya es rechazado al crear
    await expect(s.createPayment.run(request([{ invoiceId: INVOICE, amount: 100.01 }]))).rejects.toThrow(PaymentExceedsBalanceError);

    // O si ya se pago 60 y otro pago intenta pagar 50
    await confirmed(s, [{ invoiceId: INVOICE, amount: 60 }]);
    await expect(s.createPayment.run(request([{ invoiceId: INVOICE, amount: 50 }]))).rejects.toThrow(PaymentExceedsBalanceError);
  });

  it('rejects a payment for an invoice of another supplier', async () => {
    const s = world();

    await expect(s.createPayment.run(request([{ invoiceId: THIRD_INVOICE, amount: 10 }]))).rejects.toThrow(InvoiceOfAnotherSupplierError);
  });

  it('rejects an invoice of another tenant', async () => {
    const s = world();

    await expect(s.createPayment.run(request([{ invoiceId: FOREIGN_INVOICE, amount: 10 }]))).rejects.toThrow(PayableInvoiceNotFoundError);
  });

  it('rejects a non-existent supplier', async () => {
    const s = world();

    await expect(
      s.createPayment.run(request([{ invoiceId: INVOICE, amount: 10 }], { supplierId: 'e8999999-9999-4999-8999-999999999999' })),
    ).rejects.toThrow(PayableSupplierNotFoundError);
  });

  it('updates a draft payment but rejects updates on confirmed payments', async () => {
    const s = world();

    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 30 }]));
    const draft = await latest(s);

    await s.updatePayment.run({
      ...request([{ invoiceId: INVOICE, amount: 50 }], { reference: 'TRF-UPDATED' }),
      paymentId: draft.id,
    });

    const updated = await latest(s);
    expect(updated.amount).toBe(50);
    expect(updated.reference).toBe('TRF-UPDATED');

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: draft.id });

    await expect(
      s.updatePayment.run({
        ...request([{ invoiceId: INVOICE, amount: 20 }]),
        paymentId: draft.id,
      }),
    ).rejects.toThrow(PaymentNotEditableError);
  });

  it('cancels a confirmed payment and restores the invoice balance', async () => {
    const s = world();

    await confirmed(s, [{ invoiceId: INVOICE, amount: 40 }]);

    const invAfterConfirm = (await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] }))[0];
    expect(invAfterConfirm.balance()).toBe(60);

    const payment = await latest(s);
    await s.cancelPayment.run({ tenantId: TENANT_A, paymentId: payment.id });

    const cancelledPayment = await latest(s);
    expect(cancelledPayment.status).toBe('cancelled');

    const invAfterCancel = (await s.store.ledger.invoices({ value: TENANT_A } as any, { ids: [INVOICE] }))[0];
    expect(invAfterCancel.balance()).toBe(100);
  });
});
