import { describe, expect, it } from 'vitest';
import {
  InvoiceNotPayableError,
  InvoiceOfAnotherCustomerError,
  PaymentExceedsBalanceError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  ReceivableCustomerNotFoundError,
  ReceivableInvoiceNotFoundError,
} from '../domain/errors/receivables.errors.js';
import { PaymentId } from '../domain/payment/customer-payment.entity.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CUSTOMER, INVOICE, OTHER_CUSTOMER, OTHER_INVOICE, TENANT_A, TENANT_B } from '../domain/testing/receivables.mother.js';
import { PaymentRequest } from './create-payment/payment-creator.js';
import { ReceivablesScenario, aReceivablesScenario } from './testing/receivables-scenario.js';

const FOREIGN_INVOICE = 'f9999999-9999-4999-8999-999999999999';
const THIRD_INVOICE = 'f3333333-3333-4333-8333-333333333333';

// Delta debe dos facturas (100 que vence el 20 y 50 que vencio el 10) y tiene 500 de limite.
// Omega, de la misma empresa, debe una. Globex tiene su propia factura.
function world(): ReceivablesScenario {
  const s = aReceivablesScenario();

  s.store.customer(TENANT_A, { id: CUSTOMER, code: 'CLI000001', name: 'Comercial Delta', paymentTermDays: 15, creditLimit: 500, isActive: true });
  s.store.customer(TENANT_A, { id: OTHER_CUSTOMER, code: 'CLI000002', name: 'Talleres Omega', paymentTermDays: 0, creditLimit: null, isActive: false });
  s.store.invoice(TENANT_A, { id: INVOICE, code: 'FAC000002', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', exchangeRate: 1, total: 100 });
  s.store.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FAC000001', customerId: CUSTOMER, issueDate: '2025-12-26', dueDate: '2026-01-10', status: 'issued', exchangeRate: 1, total: 50 });
  s.store.invoice(TENANT_A, { id: THIRD_INVOICE, code: 'FAC000003', customerId: OTHER_CUSTOMER, issueDate: '2026-01-14', dueDate: '2026-01-14', status: 'issued', exchangeRate: 1, total: 30 });
  s.store.invoice(TENANT_B, { id: FOREIGN_INVOICE, code: 'FAC000001', customerId: 'c9999999-9999-4999-8999-999999999999', issueDate: '2026-01-05', dueDate: '2026-01-05', status: 'issued', exchangeRate: 1, total: 10 });

  return s;
}

const request = (allocations: PaymentRequest['allocations'], overrides: Partial<PaymentRequest> = {}): PaymentRequest => ({
  tenantId: TENANT_A,
  customerId: CUSTOMER,
  method: 'transfer',
  reference: 'TRF-1',
  allocations,
  ...overrides,
});

const payments = async (s: ReceivablesScenario) => (await s.searchPayments.run({ tenantId: TENANT_A })).payments;
const latest = async (s: ReceivablesScenario) => (await payments(s))[0];
const receivable = async (s: ReceivablesScenario, id = INVOICE) => (await s.searchReceivables.run({ tenantId: TENANT_A })).receivables.find((row) => row.id === id)!;
const delta = async (s: ReceivablesScenario) => (await s.searchCustomerBalances.run({ tenantId: TENANT_A })).customers.find((row) => row.customer.id === CUSTOMER);

async function confirmed(s: ReceivablesScenario, allocations: PaymentRequest['allocations'], overrides: Partial<PaymentRequest> = {}) {
  await s.createPayment.run(request(allocations, overrides));
  const payment = await latest(s);
  await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: payment.id });

  return payment;
}

describe('receivables cycle', () => {
  it('registers a draft that touches no balance until it is confirmed', async () => {
    const s = world();

    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 40 }, { invoiceId: OTHER_INVOICE, amount: 50 }]));

    expect(await latest(s)).toMatchObject({
      code: 'COB000001',
      status: 'draft',
      amount: 90,
      customer: { code: 'CLI000001', name: 'Comercial Delta' },
      allocations: [
        { invoiceCode: 'FAC000002', amount: 40 },
        { invoiceCode: 'FAC000001', amount: 50 },
      ],
    });
    expect((await receivable(s)).balance).toBe(100);

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: (await latest(s)).id });

    expect(await receivable(s)).toMatchObject({ paid: 40, balance: 60, status: 'partially_paid' });
    expect(await receivable(s, OTHER_INVOICE)).toMatchObject({ balance: 0, status: 'paid', daysOverdue: 0, bucket: null });
  });

  it('gives the balance back when a confirmed payment is cancelled', async () => {
    const s = world();
    const payment = await confirmed(s, [{ invoiceId: INVOICE, amount: 100 }]);
    expect((await receivable(s)).status).toBe('paid');

    await s.cancelPayment.run({ tenantId: TENANT_A, paymentId: payment.id });

    expect(await receivable(s)).toMatchObject({ paid: 0, balance: 100, status: 'pending' });
    expect((await latest(s)).status).toBe('cancelled');
  });

  it('lets two drafts that each fit be confirmed only while the invoice still owes', async () => {
    const s = world();
    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 70 }]));
    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 70 }]));
    const [second, first] = await payments(s);

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: first.id });

    await expect(s.confirmPayment.run({ tenantId: TENANT_A, paymentId: second.id })).rejects.toThrow(PaymentExceedsBalanceError);
    expect((await receivable(s)).balance).toBe(30);
  });

  it('refuses up front what cannot be paid, without spending a number', async () => {
    const s = world();

    await expect(s.createPayment.run(request([{ invoiceId: INVOICE, amount: 100.01 }]))).rejects.toThrow(PaymentExceedsBalanceError);
    await expect(s.createPayment.run(request([{ invoiceId: THIRD_INVOICE, amount: 1 }]))).rejects.toThrow(InvoiceOfAnotherCustomerError);
    await expect(s.createPayment.run(request([{ invoiceId: FOREIGN_INVOICE, amount: 1 }]))).rejects.toThrow(ReceivableInvoiceNotFoundError);
    await expect(s.createPayment.run(request([{ invoiceId: INVOICE, amount: 1 }], { customerId: 'c9999999-9999-4999-8999-999999999999' }))).rejects.toThrow(
      ReceivableCustomerNotFoundError,
    );

    expect(await s.codes.next(TenantId.of(TENANT_A), 'COB')).toBe(1);
  });

  it('collects from an inactive customer: deactivating does not forgive the debt', async () => {
    const s = world();

    await confirmed(s, [{ invoiceId: THIRD_INVOICE, amount: 30 }], { customerId: OTHER_CUSTOMER, method: 'cash' });

    expect((await receivable(s, THIRD_INVOICE)).status).toBe('paid');
  });

  it('refuses to confirm a payment whose invoice was cancelled in the meantime', async () => {
    const s = world();
    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 10 }]));

    s.store.cancelInvoice(INVOICE);

    await expect(s.confirmPayment.run({ tenantId: TENANT_A, paymentId: (await latest(s)).id })).rejects.toThrow(InvoiceNotPayableError);
    expect((await s.searchReceivables.run({ tenantId: TENANT_A })).receivables.map((row) => row.code)).toEqual(['FAC000001', 'FAC000003']);
  });

  it('edits a draft keeping what stays, and nothing once confirmed', async () => {
    const s = world();
    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 10 }]));
    const draft = await latest(s);
    const [before] = (await s.store.payments.find(TenantId.of(TENANT_A), PaymentId.of(draft.id)))!.toPrimitives().allocations;

    await s.updatePayment.run({ ...request([{ invoiceId: OTHER_INVOICE, amount: 5 }, { invoiceId: INVOICE, amount: 20 }]), paymentId: draft.id });
    const after = (await s.store.payments.find(TenantId.of(TENANT_A), PaymentId.of(draft.id)))!.toPrimitives().allocations;

    expect(after.find((allocation) => allocation.invoiceId === INVOICE)).toEqual({ ...before, amount: 20 });
    expect((await latest(s)).amount).toBe(25);

    await s.confirmPayment.run({ tenantId: TENANT_A, paymentId: draft.id });
    await expect(s.updatePayment.run({ ...request([{ invoiceId: INVOICE, amount: 1 }]), paymentId: draft.id })).rejects.toThrow(PaymentNotEditableError);
  });

  it('answers as missing a payment of another company', async () => {
    const s = world();
    const payment = await confirmed(s, [{ invoiceId: INVOICE, amount: 1 }]);

    await expect(s.cancelPayment.run({ tenantId: TENANT_B, paymentId: payment.id })).rejects.toThrow(PaymentNotFoundError);
    expect(await s.searchPayments.run({ tenantId: TENANT_B })).toEqual({ payments: [] });
  });

  it('ages what is owed and blocks credit while something is overdue, again after a payment is cancelled', async () => {
    const s = world();

    expect(await delta(s)).toMatchObject({ balance: 150, overdue: 50, availableCredit: 350, creditBlocked: true, aging: { current: 100, days1To30: 50, total: 150 } });

    const payment = await confirmed(s, [{ invoiceId: OTHER_INVOICE, amount: 50 }]);
    expect(await delta(s)).toMatchObject({ balance: 100, overdue: 0, availableCredit: 400, creditBlocked: false });

    s.clock.travelTo(new Date('2026-03-01T10:00:00.000Z'));
    expect((await delta(s))?.aging).toMatchObject({ current: 0, days31To60: 100 });

    await s.cancelPayment.run({ tenantId: TENANT_A, paymentId: payment.id });
    expect(await delta(s)).toMatchObject({ balance: 150, overdue: 150, creditBlocked: true, aging: { days1To30: 0, days31To60: 150, days61To90: 0, over90: 0 } });
    expect((await s.searchCustomerBalances.run({ tenantId: TENANT_A })).totals.total).toBe(180);
  });

  // La consistencia que pide el plan: el estado de cuenta termina en lo que deben las facturas.
  it('keeps the statement consistent with the balance of every invoice, whatever is paid or cancelled', async () => {
    const s = world();
    await confirmed(s, [{ invoiceId: INVOICE, amount: 40 }, { invoiceId: OTHER_INVOICE, amount: 10 }], { date: '2026-01-12' });
    const cancelled = await confirmed(s, [{ invoiceId: INVOICE, amount: 60 }]);
    await s.cancelPayment.run({ tenantId: TENANT_A, paymentId: cancelled.id });
    await confirmed(s, [{ invoiceId: OTHER_INVOICE, amount: 15.55 }]);
    await s.createPayment.run(request([{ invoiceId: INVOICE, amount: 1 }]));

    const { summary, movements } = await s.searchCustomerStatement.run({ tenantId: TENANT_A, customerId: CUSTOMER });
    const owed = (await s.searchReceivables.run({ tenantId: TENANT_A, customerId: CUSTOMER })).receivables.reduce((sum, row) => sum + Math.round(row.balance * 100), 0) / 100;

    expect(movements.map(({ type, code, debit, credit, balance }) => [type, code, debit, credit, balance])).toEqual([
      ['invoice', 'FAC000001', 50, 0, 50],
      ['invoice', 'FAC000002', 100, 0, 150],
      ['payment', 'COB000001', 0, 50, 100],
      ['payment', 'COB000003', 0, 15.55, 84.45],
    ]);
    expect(summary.balance).toBe(84.45);
    expect(owed).toBe(84.45);
  });

  it('does not show a statement for a customer of another company', async () => {
    const s = world();

    await expect(s.searchCustomerStatement.run({ tenantId: TENANT_B, customerId: CUSTOMER })).rejects.toThrow(ReceivableCustomerNotFoundError);
    await expect(s.searchReceivables.run({ tenantId: TENANT_B, customerId: CUSTOMER })).rejects.toThrow(ReceivableCustomerNotFoundError);
  });
});
