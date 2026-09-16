import { baseToNumber } from '../shared/amount.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { ReceivableInvoice } from '../ledger/receivable-invoice.js';

export const AGING_BUCKETS = ['current', 'days1To30', 'days31To60', 'days61To90', 'over90'] as const;

export type AgingBucket = (typeof AGING_BUCKETS)[number];

export type AgingTotals = Record<AgingBucket | 'total', number>;

// Por vencer, o los dias que lleva vencida. Una factura sin saldo no esta en ningun tramo.
export function bucketOf(invoice: ReceivableInvoice, today: ReceivablesDate): AgingBucket | null {
  if (invoice.balanceBase() <= 0n) return null;

  const days = invoice.daysOverdue(today);

  if (days === 0) return 'current';
  if (days <= 30) return 'days1To30';
  if (days <= 60) return 'days31To60';
  if (days <= 90) return 'days61To90';

  return 'over90';
}

export function agingOf(invoices: ReceivableInvoice[], today: ReceivablesDate): AgingTotals {
  const base = Object.fromEntries([...AGING_BUCKETS, 'total'].map((bucket) => [bucket, 0n])) as Record<AgingBucket | 'total', bigint>;

  for (const invoice of invoices) {
    const bucket = bucketOf(invoice, today);

    if (!bucket) continue;

    base[bucket] += invoice.balanceBase();
    base.total += invoice.balanceBase();
  }

  return Object.fromEntries(Object.entries(base).map(([bucket, value]) => [bucket, baseToNumber(value)])) as AgingTotals;
}
