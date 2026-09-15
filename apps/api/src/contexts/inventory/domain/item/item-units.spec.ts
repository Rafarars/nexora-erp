import { describe, expect, it } from 'vitest';
import { InvalidConversionFactorError, InvalidItemUnitsError } from '../errors/item.errors.js';
import { UNIT_BOX, UNIT_KILO, UNIT_PIECE } from '../testing/item.mother.js';
import { UnitRef } from '../shared/references.vo.js';
import { ItemUnit, ItemUnits } from './item-units.js';

describe('ItemUnits', () => {
  it('accepts a base unit and a box of 24', () => {
    const units = ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 24, false)]);

    expect(units.base().unitId.value).toBe(UNIT_PIECE);
    expect(units.uses(UnitRef.of(UNIT_BOX))).toBe(true);
    expect(units.uses(UnitRef.of(UNIT_KILO))).toBe(false);
  });

  it('needs at least one unit', () => {
    expect(() => ItemUnits.of([])).toThrow(InvalidItemUnitsError);
  });

  // Todo el stock se guardara en la unidad base: sin ella, o con dos, no hay donde.
  it('needs a base unit', () => {
    expect(() => ItemUnits.of([ItemUnit.of(UNIT_BOX, 24, false)])).toThrow(/exactly one base unit/);
  });

  it('refuses two base units', () => {
    expect(() => ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_KILO, 1, true)])).toThrow(
      /exactly one base unit/,
    );
  });

  it('refuses a base unit whose factor is not 1', () => {
    expect(() => ItemUnits.of([ItemUnit.of(UNIT_PIECE, 2, true)])).toThrow(/factor of 1/);
  });

  it('refuses the same unit twice', () => {
    expect(() => ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_PIECE, 12, false)])).toThrow(
      /more than once/,
    );
  });

  it.each([0, -1, 0.00001, Number.NaN])('refuses a conversion factor of %d', (factor) => {
    expect(() => ItemUnit.of(UNIT_BOX, factor, false)).toThrow(InvalidConversionFactorError);
  });

  // Medio kilo por unidad es legitimo: el factor puede ser menor que 1.
  it('accepts a fractional factor', () => {
    expect(ItemUnit.of(UNIT_KILO, 0.5, false).factor.value).toBe(0.5);
  });

  it('survives a round trip to primitives', () => {
    const rows = [
      { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true },
      { unitId: UNIT_BOX, conversionFactor: 24, isBase: false },
    ];

    expect(ItemUnits.fromPrimitives(rows).toPrimitives()).toEqual(rows);
  });
});
