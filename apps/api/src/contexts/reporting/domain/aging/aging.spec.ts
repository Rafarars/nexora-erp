import { describe, expect, it } from 'vitest';
import { ReportDate } from '../shared/report-date.vo.js';
import { agingOf, bucketOf } from './aging.js';

const today = ReportDate.of('2026-06-30');

describe('aging', () => {
  it.each([
    ['2026-07-01', 'current'],
    ['2026-06-30', 'current'],
    ['2026-06-29', 'days1To30'],
    ['2026-05-31', 'days1To30'],
    ['2026-05-30', 'days31To60'],
    ['2026-04-30', 'days61To90'],
    ['2026-03-31', 'over90'],
  ])('puts an invoice due on %s in %s', (dueDate, bucket) => {
    expect(bucketOf(dueDate, today)).toBe(bucket);
  });

  it('adds balances in cents and skips what owes nothing', () => {
    expect(agingOf([{ dueDate: '2026-07-01', balance: 0.1 }, { dueDate: '2026-07-01', balance: 0.2 }, { dueDate: '2026-01-01', balance: 0 }], today)).toEqual({
      current: 0.3,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      over90: 0,
      total: 0.3,
    });
  });
});
