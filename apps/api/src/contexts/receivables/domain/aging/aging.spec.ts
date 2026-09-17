import { describe, expect, it } from 'vitest';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { anInvoice } from '../testing/receivables.mother.js';
import { agingOf, bucketOf } from './aging.js';

const today = ReceivablesDate.of('2026-06-30');
const dueOn = (dueDate: string, overrides = {}) => anInvoice({ issueDate: '2026-01-01', dueDate, ...overrides });

describe('aging', () => {
  it.each([
    ['2026-06-30', 'current'],
    ['2026-06-29', 'days1To30'],
    ['2026-05-31', 'days1To30'],
    ['2026-05-30', 'days31To60'],
    ['2026-05-01', 'days31To60'],
    ['2026-04-30', 'days61To90'],
    ['2026-04-01', 'days61To90'],
    ['2026-03-31', 'over90'],
  ])('puts an invoice due on %s in %s', (dueDate, bucket) => {
    expect(bucketOf(dueOn(dueDate), today)).toBe(bucket);
  });

  it('leaves out what owes nothing and adds up the rest in cents', () => {
    const totals = agingOf(
      [dueOn('2026-07-15', { total: 0.1 }), dueOn('2026-07-20', { total: 0.2 }), dueOn('2026-06-01', { total: 50, paid: 20 }), dueOn('2026-01-01', { paid: 100 }), dueOn('2026-01-01', { status: 'cancelled' })],
      today,
      2,
    );

    expect(totals).toEqual({ current: 0.3, days1To30: 30, days31To60: 0, days61To90: 0, over90: 0, total: 30.3 });
  });
});
