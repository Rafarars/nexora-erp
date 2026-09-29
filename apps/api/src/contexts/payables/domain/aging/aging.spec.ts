import { describe, expect, it } from 'vitest';
import { agingOf, bucketOf } from './aging.js';
import { PayableInvoice } from '../ledger/payable-invoice.js';
import { PayablesDate } from '../shared/payables-date.vo.js';

const TODAY = PayablesDate.of('2026-09-20');

function invoice(props: {
  dueDate: string;
  total: number;
  paid?: number;
  status?: 'draft' | 'confirmed' | 'cancelled';
  currency?: string;
  exchangeRate?: number | null;
}): PayableInvoice {
  return PayableInvoice.of({
    id: 'e4000000-0000-4000-8000-000000000001',
    code: 'FCP000001',
    supplierId: 'e8000000-0000-4000-8000-000000000001',
    issueDate: '2026-09-01',
    dueDate: props.dueDate,
    status: props.status ?? 'confirmed',
    total: props.total,
    paid: props.paid ?? 0,
    currency: props.currency ?? 'USD',
    exchangeRate: props.exchangeRate ?? null,
    baseCurrency: 'USD',
    baseExchangeRate: props.exchangeRate ?? null,
    manualExchangeRate: false,
  });
}

describe('payables aging', () => {
  it('returns null for an invoice with zero balance', () => {
    const fullyPaid = invoice({ dueDate: '2026-09-10', total: 100, paid: 100 });
    expect(bucketOf(fullyPaid, TODAY)).toBeNull();
  });

  it('returns null for a cancelled invoice', () => {
    const cancelled = invoice({ dueDate: '2026-09-10', total: 100, status: 'cancelled' });
    expect(bucketOf(cancelled, TODAY)).toBeNull();
  });

  it('classifies not-yet-due invoices as current', () => {
    const current = invoice({ dueDate: '2026-09-25', total: 100 });
    expect(bucketOf(current, TODAY)).toBe('current');
  });

  it('classifies invoices due today as current', () => {
    const dueToday = invoice({ dueDate: '2026-09-20', total: 100 });
    expect(bucketOf(dueToday, TODAY)).toBe('current');
  });

  it('classifies 1 to 30 days overdue in days1To30', () => {
    const overdue10 = invoice({ dueDate: '2026-09-10', total: 100 });
    expect(bucketOf(overdue10, TODAY)).toBe('days1To30');
  });

  it('classifies 31 to 60 days overdue in days31To60', () => {
    const overdue45 = invoice({ dueDate: '2026-08-06', total: 100 });
    expect(bucketOf(overdue45, TODAY)).toBe('days31To60');
  });

  it('classifies 61 to 90 days overdue in days61To90', () => {
    const overdue75 = invoice({ dueDate: '2026-07-07', total: 100 });
    expect(bucketOf(overdue75, TODAY)).toBe('days61To90');
  });

  it('classifies more than 90 days overdue in over90', () => {
    const overdue100 = invoice({ dueDate: '2026-06-10', total: 100 });
    expect(bucketOf(overdue100, TODAY)).toBe('over90');
  });

  it('sums aging buckets and total correctly across invoices', () => {
    const list = [
      invoice({ dueDate: '2026-09-25', total: 50 }), // current
      invoice({ dueDate: '2026-09-15', total: 100, paid: 20 }), // days1To30 (80)
      invoice({ dueDate: '2026-08-01', total: 200 }), // days31To60 (200)
      invoice({ dueDate: '2026-07-01', total: 300 }), // days61To90 (300)
      invoice({ dueDate: '2026-05-01', total: 400 }), // over90 (400)
      invoice({ dueDate: '2026-09-01', total: 100, paid: 100 }), // paid (0)
    ];

    const result = agingOf(list, TODAY, 2);

    expect(result).toEqual({
      current: 50,
      days1To30: 80,
      days31To60: 200,
      days61To90: 300,
      over90: 400,
      total: 1030,
    });
  });
});
