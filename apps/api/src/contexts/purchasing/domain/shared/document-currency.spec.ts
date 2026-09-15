import { describe, expect, it } from 'vitest';
import { aDocumentCurrency } from '../testing/purchasing.mother.js';
import { DocumentCurrency } from './document-currency.js';
import { UnitCost } from './money.js';

describe('DocumentCurrency', () => {
  // 0,50 EUR con el euro a 175,05 Bs y el dolar a 153,10 Bs son 0,571685 USD.
  it('carries a cost to the company currency through the bolivar', () => {
    const euros = aDocumentCurrency({ currency: 'EUR', exchangeRate: 175.05, baseExchangeRate: 153.1 });

    expect(euros.toBase(UnitCost.of(0.5)).toNumber()).toBe(0.571685);
  });

  it('leaves a cost in the company currency as it is, whatever the rate', () => {
    expect(aDocumentCurrency({ exchangeRate: 36.5, baseExchangeRate: 36.5 }).toBase(UnitCost.of(0.5)).toNumber()).toBe(0.5);
  });

  it('leaves as it is the cost of a document written before the rates', () => {
    const legacy = DocumentCurrency.fromPrimitives({ currency: 'USD', exchangeRate: null, baseCurrency: 'USD', baseExchangeRate: null, manualExchangeRate: false });

    expect(legacy.toBase(UnitCost.of(0.5)).toNumber()).toBe(0.5);
    expect(legacy.manualRate()).toBeNull();
  });

  it('remembers only a rate written by hand', () => {
    expect(aDocumentCurrency({ currency: 'EUR', exchangeRate: 41, manualRate: true }).manualRate()).toBe(41);
    expect(aDocumentCurrency({ currency: 'EUR', exchangeRate: 41 }).manualRate()).toBeNull();
  });
});
