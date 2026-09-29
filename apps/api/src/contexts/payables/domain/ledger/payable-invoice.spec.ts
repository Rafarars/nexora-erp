import { describe, expect, it } from 'vitest';
import {
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PaymentBeforeInvoiceError,
  PaymentExceedsBalanceError,
} from '../errors/payables.errors.js';
import { PayablesDate } from '../shared/payables-date.vo.js';
import { PayableInvoice } from './payable-invoice.js';

const INVOICE_ROW = {
  id: 'f1111111-1111-4111-8111-111111111111',
  code: 'FCP-0001',
  supplierId: 'e8111111-1111-4111-8111-111111111111',
  issueDate: '2026-03-01',
  dueDate: '2026-03-15',
  status: 'confirmed' as const,
  total: 100,
  paid: 0,
  currency: 'USD',
  exchangeRate: 50,
  baseCurrency: 'VES',
  baseExchangeRate: 50,
  manualExchangeRate: false,
};

describe('PayableInvoice', () => {
  it('calculates balance as total minus paid', () => {
    const invoice = PayableInvoice.of({ ...INVOICE_ROW, total: 100, paid: 30 });
    expect(invoice.balance()).toBe(70);
    expect(invoice.paymentStatus()).toBe('partially_paid');
  });

  it('marks paid when balance reaches zero', () => {
    const invoice = PayableInvoice.of({ ...INVOICE_ROW, total: 100, paid: 100 });
    expect(invoice.balance()).toBe(0);
    expect(invoice.paymentStatus()).toBe('paid');
  });

  it('rejects payments on draft or cancelled invoices', () => {
    const draftInvoice = PayableInvoice.of({ ...INVOICE_ROW, status: 'draft' });
    expect(() =>
      draftInvoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2026-03-05'), 500_000n),
    ).toThrow(InvoiceNotPayableError);

    const cancelledInvoice = PayableInvoice.of({ ...INVOICE_ROW, status: 'cancelled' });
    expect(() =>
      cancelledInvoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2026-03-05'), 500_000n),
    ).toThrow(InvoiceNotPayableError);
  });

  it('rejects payments for another supplier', () => {
    const invoice = PayableInvoice.of(INVOICE_ROW);
    expect(() =>
      invoice.ensureAccepts('e8222222-2222-4222-8222-222222222222', PayablesDate.of('2026-03-05'), 500_000n),
    ).toThrow(InvoiceOfAnotherSupplierError);
  });

  it('rejects payment dated before invoice issue date', () => {
    const invoice = PayableInvoice.of(INVOICE_ROW);
    expect(() =>
      invoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2026-02-28'), 500_000n),
    ).toThrow(PaymentBeforeInvoiceError);
  });

  it('rejects payments that exceed the remaining balance', () => {
    const invoice = PayableInvoice.of({ ...INVOICE_ROW, total: 100, paid: 60 });
    // Saldo restante es 40 (400_000n en diezmilesimas). Intentar pagar 40.01 (400_100n)
    expect(() =>
      invoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2026-03-05'), 400_100n),
    ).toThrow(PaymentExceedsBalanceError);
  });

  it('accepts payments within balance', () => {
    const invoice = PayableInvoice.of({ ...INVOICE_ROW, total: 100, paid: 60 });
    expect(() =>
      invoice.ensureAccepts(INVOICE_ROW.supplierId, PayablesDate.of('2026-03-05'), 400_000n),
    ).not.toThrow();
  });

  it('calculates days overdue and overdue status', () => {
    const invoice = PayableInvoice.of(INVOICE_ROW);
    expect(invoice.isOverdue(PayablesDate.of('2026-03-10'))).toBe(false);
    expect(invoice.daysOverdue(PayablesDate.of('2026-03-10'))).toBe(0);

    expect(invoice.isOverdue(PayablesDate.of('2026-03-20'))).toBe(true);
    expect(invoice.daysOverdue(PayablesDate.of('2026-03-20'))).toBe(5);
  });
});
