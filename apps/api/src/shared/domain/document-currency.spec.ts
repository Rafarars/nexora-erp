import { describe, expect, it } from 'vitest';
import { amountUnits, roundRatio, unitsToNumber } from './amount.js';
import { DocumentCurrency } from './document-currency.js';

const of = (overrides: Partial<{ currency: string; exchangeRate: number | null; baseExchangeRate: number | null; manualExchangeRate: boolean }> = {}) =>
  DocumentCurrency.fromPrimitives({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false, ...overrides });

describe('DocumentCurrency', () => {
  // 0,50 EUR con el euro a 175,05 Bs y el dolar a 153,10 Bs son 0,571685 USD.
  it('carries a cost to the company currency through the bolivar, keeping its scale', () => {
    expect(of({ currency: 'EUR', exchangeRate: 175.05, baseExchangeRate: 153.1 }).toBase(500_000n)).toBe(571_685n);
  });

  it('carries an amount to the company currency rounded to its decimals', () => {
    const euros = of({ currency: 'EUR', exchangeRate: 40, baseExchangeRate: 36.5 });

    expect(unitsToNumber(euros.baseAmount(amountUnits(100), 2))).toBe(109.59);
    expect(unitsToNumber(euros.baseAmount(amountUnits(100), 4))).toBe(109.589);
  });

  it('says what an amount is worth in bolivars, and nothing without a rate', () => {
    expect(unitsToNumber(of().bolivars(amountUnits(1.005), 2)!)).toBe(36.68);
    expect(unitsToNumber(of({ currency: 'VES', exchangeRate: 1 }).bolivars(amountUnits(10), 2)!)).toBe(10);
    expect(of({ exchangeRate: null, baseExchangeRate: null }).bolivars(amountUnits(10), 2)).toBeNull();
  });

  it('leaves as it is what is in the company currency or was written before the rates', () => {
    expect(of({ exchangeRate: 36.5, baseExchangeRate: 36.5 }).toBase(500_000n)).toBe(500_000n);
    expect(of({ currency: 'EUR', exchangeRate: null, baseExchangeRate: null }).baseAmount(amountUnits(5), 2)).toBe(amountUnits(5));
  });

  it('remembers only a rate written by hand', () => {
    expect(of({ currency: 'EUR', exchangeRate: 41, manualExchangeRate: true }).manualRate()).toBe(41);
    expect(of({ currency: 'EUR', exchangeRate: 41 }).manualRate()).toBeNull();
  });

  it('rounds half away from zero, also a negative difference', () => {
    expect(roundRatio(-12_345n, 1n, 2)).toBe(-12_300n);
    expect(roundRatio(-12_350n, 1n, 2)).toBe(-12_400n);
  });
});
