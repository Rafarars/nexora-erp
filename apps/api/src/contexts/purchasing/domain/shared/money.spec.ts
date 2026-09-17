import { describe, expect, it } from 'vitest';
import { InvalidPurchaseCostError, InvalidPurchaseQuantityError, InvalidTaxRateSnapshotError } from '../errors/purchasing.errors.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { TaxRate, UnitCost, lineSubtotalUnits, taxUnits } from './money.js';
import { Quantity } from './quantity.vo.js';

describe('purchase amounts', () => {
  it('multiplies quantity by cost and rounds once per line to the decimals of the company', () => {
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(3), UnitCost.of(0.335), 2))).toBe(1.01);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(2.5), UnitCost.of(12.123456), 2))).toBe(30.31);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(2.5), UnitCost.of(12.123456), 4))).toBe(30.3086);
    expect(unitsToNumber(lineSubtotalUnits(Quantity.of(2.5), UnitCost.of(12.123456), 0))).toBe(30);
  });

  it('computes the tax on the rounded subtotal, half up', () => {
    expect(unitsToNumber(taxUnits(10_0500n, TaxRate.of(16), 2))).toBe(1.61);
    expect(unitsToNumber(taxUnits(10_0000n, TaxRate.of(0), 2))).toBe(0);
  });

  it('spreads the cost of a box over its base units', () => {
    expect(UnitCost.of(12).perBase(Quantity.of(2), Quantity.of(48)).toNumber()).toBe(0.5);
  });

  it('takes the proportional part of a base quantity', () => {
    expect(Quantity.of(48).proportionOf(Quantity.of(1.5), Quantity.of(2)).toNumber()).toBe(36);
  });

  it('rejects impossible values', () => {
    expect(() => UnitCost.of(-1)).toThrow(InvalidPurchaseCostError);
    expect(() => UnitCost.of(1.0000001)).toThrow(InvalidPurchaseCostError);
    expect(() => TaxRate.of(101)).toThrow(InvalidTaxRateSnapshotError);
    expect(() => Quantity.of(0.00001)).toThrow(InvalidPurchaseQuantityError);
    expect(() => Quantity.of(Number.NaN)).toThrow(InvalidPurchaseQuantityError);
  });

  // Lo pedido menos lo recibido tiene que dar cero exacto, tambien con decimales.
  it('keeps quantities exact across many partial receipts', () => {
    let pending = Quantity.of(10);

    for (let i = 0; i < 100; i += 1) pending = pending.minus(Quantity.of(0.1));

    expect(pending.isZero()).toBe(true);
  });
});
