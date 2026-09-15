import { describe, expect, it } from 'vitest';
import { CompanyTextTooLongError, InvalidExchangeRateError, InvalidRateDateError, InvalidRateTypeError, LocalCurrencyRateError } from '../errors/company.errors.js';
import { LATER, aRate, aRateInput } from '../testing/company.mother.js';
import { ExchangeRate, exchangeRateDetailsOf } from './exchange-rate.entity.js';
import { RATE_MAX } from './rate-value.vo.js';

const details = (overrides: Parameters<typeof aRateInput>[0]) => exchangeRateDetailsOf(aRateInput(overrides));

describe('ExchangeRate', () => {
  it.each([0.00000001, 36.5, 1234567.12345678, RATE_MAX])('accepts the rate %s', (rate) => {
    expect(details({ rate }).rate.value).toBe(rate);
  });

  // Nueve decimales se redondearian en silencio en la columna; diez millones ya no caben exactos.
  it.each([0, -36.5, Number.NaN, Number.POSITIVE_INFINITY, 36.123456789, 10_000_000])('rejects the rate %s', (rate) => {
    expect(() => details({ rate })).toThrow(InvalidExchangeRateError);
  });

  it('refuses a rate for the bolivar, however it is written', () => {
    expect(() => details({ currency: ' ves ' })).toThrow(LocalCurrencyRateError);
  });

  it.each(['2026-02-30', '2026-2-1', '15/01/2026', ''])('rejects the date <%s>', (rateDate) => {
    expect(() => details({ rateDate })).toThrow(InvalidRateDateError);
  });

  it('accepts a future date: the central bank publishes the rate of the next working day', () => {
    expect(details({ rateDate: '2099-12-31' }).key.rateDate.value).toBe('2099-12-31');
  });

  it('rejects a type that is neither legal nor manual', () => {
    expect(() => details({ type: 'paralela' })).toThrow(InvalidRateTypeError);
  });

  it('keeps an empty source as nothing and rejects a long one', () => {
    expect(details({ source: '   ' }).source).toBeNull();
    expect(() => details({ source: 'x'.repeat(151) })).toThrow(CompanyTextTooLongError);
  });

  it('survives a round trip to primitives', () => {
    const rate = aRate();
    rate.deactivate(LATER);

    expect(ExchangeRate.fromPrimitives(rate.toPrimitives()).toPrimitives()).toEqual(rate.toPrimitives());
  });

  it('a correction changes the rate and the source and reactivates it', () => {
    const rate = aRate();
    rate.deactivate(LATER);
    rate.correct(details({ rate: 37, source: null }), LATER);

    expect(rate.toPrimitives()).toMatchObject({ rate: 37, source: null, isActive: true, updatedAt: LATER });
  });
});
