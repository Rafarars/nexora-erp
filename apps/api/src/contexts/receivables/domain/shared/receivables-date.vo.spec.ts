import { describe, expect, it } from 'vitest';
import { FutureReceivablesDateError, InvalidReceivablesDateError } from '../errors/receivables.errors.js';
import { ReceivablesDate } from './receivables-date.vo.js';

describe('ReceivablesDate', () => {
  it('takes only real calendar days', () => {
    expect(ReceivablesDate.of('2028-02-29').value).toBe('2028-02-29');
    expect(() => ReceivablesDate.of('2026-02-29')).toThrow(InvalidReceivablesDateError);
    expect(() => ReceivablesDate.of('15/01/2026')).toThrow(InvalidReceivablesDateError);
  });

  it('counts days across months and refuses a future date', () => {
    expect(ReceivablesDate.of('2026-01-31').daysUntil(ReceivablesDate.of('2026-03-01'))).toBe(29);
    expect(ReceivablesDate.of('2026-03-01').daysUntil(ReceivablesDate.of('2026-01-31'))).toBe(-29);
    expect(() => ReceivablesDate.of('2026-01-16').ensureNotAfter(new Date('2026-01-15T23:59:59Z'))).toThrow(FutureReceivablesDateError);
  });
});
