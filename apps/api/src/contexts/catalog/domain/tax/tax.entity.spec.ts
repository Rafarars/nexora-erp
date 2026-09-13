import { describe, expect, it } from 'vitest';
import { InvalidTaxRateError } from '../errors/invalid-values.errors.js';
import { LATER, aTax } from '../testing/catalog.mother.js';
import { TaxName } from './tax-name.vo.js';
import { TaxRate } from './tax-rate.vo.js';
import { Tax } from './tax.entity.js';

describe('TaxRate', () => {
  it.each([0, 8, 16, 12.5, 99.9999, 100])('accepts %d', (value) => {
    expect(TaxRate.of(value).value).toBe(value);
  });

  it.each([-0.01, 100.0001, 16.12345, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(() => TaxRate.of(value)).toThrow(InvalidTaxRateError);
  });
});

describe('Tax', () => {
  it('survives a round trip to primitives', () => {
    const tax = aTax({ rate: 12.5 });

    expect(Tax.fromPrimitives(tax.toPrimitives()).toPrimitives()).toEqual(tax.toPrimitives());
  });

  // Los documentos copiaran el porcentaje al confirmarse: cambiarlo aqui es legitimo.
  it('changes its rate', () => {
    const tax = aTax({ rate: 16 });

    tax.update(TaxName.of('IVA general'), TaxRate.of(15), LATER);

    expect(tax.toPrimitives()).toMatchObject({ name: 'IVA general', rate: 15, updatedAt: LATER });
  });
});
