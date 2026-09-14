import { describe, expect, it } from 'vitest';
import type { Session } from '../../access/domain/session';
import { AccessError } from '../../access/domain/access-error';
import { creditLabel, customersWithDebt, overdueLabel, payableInvoices, paymentActions } from './receivables';
import type { Payment, Receivable } from './receivables';
import { readableReceivablesError } from './receivables-error';
import { visibleReceivablesSections } from './receivables-sections';

const receivable = (overrides: Partial<Receivable>): Receivable => ({
  id: 'i1', code: 'FAC000001', customer: { id: 'delta', code: 'CLI000001', name: 'Delta' }, issueDate: '2026-09-01', dueDate: '2026-09-20',
  total: 100, paid: 0, balance: 100, status: 'pending', daysOverdue: 0, bucket: 'current', ...overrides,
});

const payment = (overrides: Partial<Payment>): Payment => ({
  id: 'p1', code: 'COB000001', customer: { id: 'delta', code: 'CLI000001', name: 'Delta' }, paymentDate: '2026-09-10', method: 'cash',
  reference: null, notes: null, amount: 100, status: 'draft', allocations: [], ...overrides,
});

describe('paymentActions', () => {
  it('offers editing, confirming and cancelling a draft', () => {
    expect(paymentActions({ status: 'draft' })).toEqual({ edit: true, confirm: true, cancel: true });
  });

  // Anular un cobro confirmado es como se corrige: devuelve el saldo.
  it('offers only cancelling a confirmed payment, and nothing on a cancelled one', () => {
    expect(paymentActions({ status: 'confirmed' })).toEqual({ edit: false, confirm: false, cancel: true });
    expect(paymentActions({ status: 'cancelled' })).toEqual({ edit: false, confirm: false, cancel: false });
  });
});

describe('payment form', () => {
  const rows = [
    receivable({ id: 'late', code: 'FAC000002', dueDate: '2026-10-01' }),
    receivable({ id: 'early', code: 'FAC000001', dueDate: '2026-09-05' }),
    receivable({ id: 'paid', code: 'FAC000003', balance: 0, paid: 100, status: 'paid' }),
    receivable({ id: 'other', code: 'FAC000004', customer: { id: 'omega', code: 'CLI000002', name: 'Omega' } }),
  ];

  it('offers the invoices of the customer that still owe, the earliest due first', () => {
    expect(payableInvoices(rows, 'delta', null).map(({ invoice, amount }) => [invoice.code, amount])).toEqual([
      ['FAC000001', null],
      ['FAC000002', null],
    ]);
  });

  it('keeps on a draft the invoices it already pays, with their amounts, even if they owe nothing now', () => {
    const draft = payment({ allocations: [{ invoiceId: 'paid', invoiceCode: 'FAC000003', dueDate: '2026-09-20', amount: 40 }] });

    expect(payableInvoices(rows, 'delta', draft).map(({ invoice, amount }) => [invoice.code, amount])).toEqual([
      ['FAC000001', null],
      ['FAC000003', 40],
      ['FAC000002', null],
    ]);
  });

  it('lists as customers to collect from only those who owe, plus the one of the draft', () => {
    expect(customersWithDebt(rows, null).map((c) => c.name)).toEqual(['Delta', 'Omega']);
    expect(customersWithDebt([rows[2]], payment({ customer: { id: 'zeta', code: 'CLI000009', name: 'Zeta' } })).map((c) => c.name)).toEqual(['Zeta']);
  });
});

describe('labels', () => {
  it('says how long an invoice is overdue', () => {
    expect(overdueLabel(0)).toBe('Al día');
    expect(overdueLabel(1)).toBe('Vencida hace 1 día');
    expect(overdueLabel(45)).toBe('Vencida hace 45 días');
  });

  it('names a credit limit or its absence', () => {
    expect(creditLabel(null, String)).toBe('Sin límite');
    expect(creditLabel(0, String)).toBe('0');
  });
});

describe('readableReceivablesError', () => {
  it('translates receivables errors and falls back to sales for the rest', () => {
    const error = (code: string, fields: string[] = []) => AccessError.fromStatus(409, { code, fields, message: 'x' });

    expect(readableReceivablesError(error('PaymentExceedsBalanceError'), 'fallo')).toBe('El cobro aplica a una factura más de lo que debe.');
    expect(readableReceivablesError(error('InvoiceWithPaymentsError'), 'fallo')).toBe('La factura tiene cobros aplicados: anula primero esos cobros.');
    expect(readableReceivablesError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['allocations.0.amount'], message: 'x' }), 'fallo')).toBe(
      'Revisa los montos: cada uno debe ser un número.',
    );
  });
});

describe('visibleReceivablesSections', () => {
  it('shows only what the role can read', () => {
    const session = { permissions: ['receivables.payments.search'], grantsAll: false } as unknown as Session;

    expect(visibleReceivablesSections(session).map((section) => section.label)).toEqual(['Cobros']);
  });
});
