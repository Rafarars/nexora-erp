import { describe, expect, it } from 'vitest';
import { FuturePayablesDateError, InvalidPayablesDateError } from '../errors/payables.errors.js';
import { PayablesDate } from './payables-date.vo.js';

describe('PayablesDate', () => {
  it('accepts a valid calendar day', () => {
    expect(PayablesDate.of('2026-03-15').value).toBe('2026-03-15');
  });

  it('rejects an impossible day', () => {
    expect(() => PayablesDate.of('2026-02-31')).toThrow(InvalidPayablesDateError);
  });

  it('rejects garbage', () => {
    expect(() => PayablesDate.of('not-a-date')).toThrow(InvalidPayablesDateError);
  });

  it('rejects a date after today', () => {
    expect(() => PayablesDate.of('2026-03-16').ensureNotAfter('2026-03-15')).toThrow(FuturePayablesDateError);
  });

  it('accepts a date equal to or before today', () => {
    expect(() => PayablesDate.of('2026-03-15').ensureNotAfter('2026-03-15')).not.toThrow();
    expect(() => PayablesDate.of('2026-03-14').ensureNotAfter('2026-03-15')).not.toThrow();
  });

  it('orders dates chronologically', () => {
    const early = PayablesDate.of('2026-01-01');
    const late = PayablesDate.of('2026-01-02');

    expect(early.isBefore(late)).toBe(true);
    expect(late.isBefore(early)).toBe(false);
  });

  it('counts days between dates', () => {
    expect(PayablesDate.of('2026-01-01').daysUntil(PayablesDate.of('2026-01-10'))).toBe(9);
  });
});
