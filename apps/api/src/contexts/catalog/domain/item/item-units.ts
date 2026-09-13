import { InvalidItemUnitsError } from '../errors/invalid-values.errors.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { ConversionFactor } from './conversion-factor.vo.js';

export interface ItemUnitPrimitives {
  unitId: string;
  conversionFactor: number;
  isBase: boolean;
}

export class ItemUnit {
  private constructor(
    readonly unitId: MeasurementUnitId,
    readonly factor: ConversionFactor,
    readonly isBase: boolean,
  ) {}

  static of(unitId: string, conversionFactor: number, isBase: boolean): ItemUnit {
    return new ItemUnit(MeasurementUnitId.of(unitId), ConversionFactor.of(conversionFactor), isBase);
  }

  toPrimitives(): ItemUnitPrimitives {
    return { unitId: this.unitId.value, conversionFactor: this.factor.value, isBase: this.isBase };
  }
}

// Las unidades de un articulo como un todo, porque sus reglas son del conjunto y no de
// cada una: todo el stock se guardara en la base, asi que tiene que existir, ser una
// sola y valer 1.
export class ItemUnits {
  private constructor(private readonly units: ItemUnit[]) {}

  static of(units: ItemUnit[]): ItemUnits {
    if (units.length === 0) {
      throw new InvalidItemUnitsError('an item needs at least one unit.');
    }

    const ids = units.map((unit) => unit.unitId.value);

    if (new Set(ids).size !== ids.length) {
      throw new InvalidItemUnitsError('a unit appears more than once.');
    }

    const bases = units.filter((unit) => unit.isBase);

    if (bases.length !== 1) {
      throw new InvalidItemUnitsError(`exactly one base unit is required, received ${bases.length}.`);
    }

    if (!bases[0].factor.isOne()) {
      throw new InvalidItemUnitsError('the base unit must have a conversion factor of 1.');
    }

    // Orden canonico: la base primero y luego de menor a mayor. Asi dos articulos con
    // las mismas unidades son iguales vengan de donde vengan.
    return new ItemUnits(
      [...units].sort(
        (left, right) =>
          Number(right.isBase) - Number(left.isBase) ||
          left.factor.value - right.factor.value ||
          left.unitId.value.localeCompare(right.unitId.value),
      ),
    );
  }

  static fromPrimitives(rows: ItemUnitPrimitives[]): ItemUnits {
    return ItemUnits.of(rows.map((row) => ItemUnit.of(row.unitId, row.conversionFactor, row.isBase)));
  }

  base(): ItemUnit {
    return this.units.find((unit) => unit.isBase)!;
  }

  unitIds(): MeasurementUnitId[] {
    return this.units.map((unit) => unit.unitId);
  }

  uses(unitId: MeasurementUnitId): boolean {
    return this.units.some((unit) => unit.unitId.equals(unitId));
  }

  toPrimitives(): ItemUnitPrimitives[] {
    return this.units.map((unit) => unit.toPrimitives());
  }
}
