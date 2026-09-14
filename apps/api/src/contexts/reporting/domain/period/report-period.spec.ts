import { describe, expect, it } from 'vitest';
import { InvalidReportDateError, InvalidReportPeriodError, ReportPeriodTooLongError } from '../errors/reporting.errors.js';
import { ReportDate } from '../shared/report-date.vo.js';
import { ReportPeriod } from './report-period.js';

describe('ReportPeriod', () => {
  it('includes both ends and may be a single day', () => {
    expect(ReportPeriod.of('2026-03-01', '2026-03-01').to.value).toBe('2026-03-01');
  });

  it('refuses a period that ends before it starts or does not exist', () => {
    expect(() => ReportPeriod.of('2026-03-02', '2026-03-01')).toThrow(InvalidReportPeriodError);
    expect(() => ReportPeriod.of('2026-02-30', '2026-03-01')).toThrow(InvalidReportDateError);
  });

  it('allows up to one leap year and not a day more', () => {
    expect(() => ReportPeriod.of('2028-01-01', '2028-12-31')).not.toThrow();
    expect(() => ReportPeriod.of('2026-01-01', '2027-01-02')).toThrow(ReportPeriodTooLongError);
  });

  it('builds the month to date from today', () => {
    const period = ReportPeriod.monthToDate(ReportDate.of('2026-03-15'));

    expect([period.from.value, period.to.value]).toEqual(['2026-03-01', '2026-03-15']);
  });
});
