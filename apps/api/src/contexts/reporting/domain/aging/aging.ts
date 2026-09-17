import { amountUnits, unitsToNumber } from '../shared/money.js';
import { ReportDate } from '../shared/report-date.vo.js';

export const AGING_BUCKETS = ['current', 'days1To30', 'days31To60', 'days61To90', 'over90'] as const;

export type AgingBucket = (typeof AGING_BUCKETS)[number];

export type AgingTotals = Record<AgingBucket | 'total', number>;

// Los mismos tramos que cuentas por cobrar, calculados aqui: el reporte no importa ese modulo y
// una prueba de extremo a extremo compara las dos pantallas.
export function bucketOf(dueDate: string, today: ReportDate): AgingBucket {
  const days = Math.max(0, ReportDate.of(dueDate).daysUntil(today));

  if (days === 0) return 'current';
  if (days <= 30) return 'days1To30';
  if (days <= 60) return 'days31To60';
  if (days <= 90) return 'days61To90';

  return 'over90';
}

export function agingOf(invoices: { dueDate: string; balance: number }[], today: ReportDate): AgingTotals {
  const units = Object.fromEntries([...AGING_BUCKETS, 'total'].map((bucket) => [bucket, 0n])) as Record<AgingBucket | 'total', bigint>;

  for (const invoice of invoices) {
    const balance = amountUnits(invoice.balance);

    if (balance <= 0n) continue;

    units[bucketOf(invoice.dueDate, today)] += balance;
    units.total += balance;
  }

  return Object.fromEntries(Object.entries(units).map(([bucket, value]) => [bucket, unitsToNumber(value)])) as AgingTotals;
}
