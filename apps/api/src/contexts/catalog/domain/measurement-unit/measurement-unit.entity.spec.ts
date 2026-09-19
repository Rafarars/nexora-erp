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

    unit.update(MeasurementUnitName.of('Pieza'), UnitAbbreviation.of('pz'), false, LATER);

    expect(unit.toPrimitives()).toMatchObject({ name: 'Pieza', abbreviation: 'pz', updatedAt: LATER });
  });

  // Una unidad nace admitiendo fracciones, que es lo que hacian todas antes de la marca.
  it('admits fractions unless it is told otherwise', () => {
    expect(aUnit().toPrimitives().mustBeWhole).toBe(false);
    expect(aUnit({ mustBeWhole: true }).toPrimitives().mustBeWhole).toBe(true);
  });

  it('can start and stop demanding whole numbers', () => {
    const unit = aUnit();

    unit.update(MeasurementUnitName.of('Unidad'), UnitAbbreviation.of('un'), true, LATER);
    expect(unit.toPrimitives().mustBeWhole).toBe(true);

    unit.update(MeasurementUnitName.of('Unidad'), UnitAbbreviation.of('un'), false, LATER);
    expect(unit.toPrimitives().mustBeWhole).toBe(false);
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
