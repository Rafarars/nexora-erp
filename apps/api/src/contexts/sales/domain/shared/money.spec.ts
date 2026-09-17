import { describe, expect, it } from 'vitest';
import { InvalidSalesPriceError, InvalidSalesQuantityError, InvalidTaxRateSnapshotError } from '../errors/sales.errors.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { TaxRate, UnitPrice, lineSubtotalUnits, taxUnits } from './money.js';
import { Quantity } from './quantity.vo.js';

describe('sales amounts', () => {
  it('multiplies quantity by price and rounds once per line to the decimals of the company', () => {
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(3), UnitPrice.of(0.335), 2))).toBe(1.01);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(3), UnitPrice.of(0.335), 4))).toBe(1.005);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(2.5), UnitPrice.of(12.123456), 2))).toBe(30.31);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(2.5), UnitPrice.of(12.123456), 0))).toBe(30);
  });

  it('computes the tax on the rounded subtotal, half up', () => {
    expect(unitsToNumber(taxUnits(100_500n, TaxRate.of(16), 2))).toBe(1.61);
    expect(unitsToNumber(taxUnits(100_500n, TaxRate.of(16), 4))).toBe(1.608);
    expect(unitsToNumber(taxUnits(100_000n, TaxRate.of(0), 2))).toBe(0);
  });

  it('takes the proportional part of a base quantity', () => {
    expect(Quantity.of(48).proportionOf(Quantity.of(1.5), Quantity.of(2)).toNumber()).toBe(36);
  });

  it('rejects impossible values', () => {
    expect(() => UnitPrice.of(-1)).toThrow(InvalidSalesPriceError);
    expect(() => UnitPrice.of(1.0000001)).toThrow(InvalidSalesPriceError);
    expect(() => TaxRate.of(101)).toThrow(InvalidTaxRateSnapshotError);
    expect(() => Quantity.of(0.00001)).toThrow(InvalidSalesQuantityError);
    expect(() => Quantity.of(Number.NaN)).toThrow(InvalidSalesQuantityError);
  });

  // Lo pedido menos lo recibido tiene que dar cero exacto, tambien con decimales.
  it('keeps quantities exact across many partial receipts', () => {
    let pending = Quantity.of(10);

    for (let i = 0; i < 100; i += 1) pending = pending.minus(Quantity.of(0.1));

    expect(pending.isZero()).toBe(true);
  });
});
