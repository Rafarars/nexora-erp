import { describe, expect, it } from 'vitest';
import { LATER, aUnit } from '../testing/catalog.mother.js';
import { MeasurementUnitName } from './measurement-unit-name.vo.js';
import { MeasurementUnit } from './measurement-unit.entity.js';
import { InvalidAbbreviationError, UnitAbbreviation } from './unit-abbreviation.vo.js';

describe('MeasurementUnit', () => {
  it('survives a round trip to primitives', () => {
    const unit = aUnit();

    expect(MeasurementUnit.fromPrimitives(unit.toPrimitives()).toPrimitives()).toEqual(unit.toPrimitives());
  });

  it('updates its name and abbreviation', () => {
    const unit = aUnit();

    unit.update(MeasurementUnitName.of('Pieza'), UnitAbbreviation.of('pz'), LATER);

    expect(unit.toPrimitives()).toMatchObject({ name: 'Pieza', abbreviation: 'pz', updatedAt: LATER });
  });
});

describe('UnitAbbreviation', () => {
  it('keeps the case the person wrote: kg and Kg are written on purpose', () => {
    expect(UnitAbbreviation.of(' Kg ').value).toBe('Kg');
  });

  // Se imprime pegada a la cantidad: "12 c ja" no se lee.
  it('rejects spaces inside', () => {
    expect(() => UnitAbbreviation.of('c ja')).toThrow(InvalidAbbreviationError);
  });

  it('rejects more than ten characters', () => {
    expect(() => UnitAbbreviation.of('x'.repeat(11))).toThrow(/longer than 10/);
  });
});
