import { InvalidUnitCostError } from '../errors/inventory.errors.js';
import { Quantity } from './quantity.vo.js';

const MAX_MICROS = 999_999_999_999_999_999n;

// Costo por unidad en millonesimas, como entero por la misma razon que Quantity.
export class UnitCost {
  private constructor(readonly micros: bigint) {}

  static of(value: number): UnitCost {
    const scaled = Math.round(value * 1_000_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 1_000_000) > 1e-3) {
      throw new InvalidUnitCostError(value);
    }

    return UnitCost.fromMicros(BigInt(scaled), value);
  }

  static fromMicros(micros: bigint, original: number = Number(micros) / 1_000_000): UnitCost {
    if (micros < 0n || micros > MAX_MICROS) {
      throw new InvalidUnitCostError(original);
    }

    return new UnitCost(micros);
  }

  static zero(): UnitCost {
    return new UnitCost(0n);
  }

  // Cuanto cuesta cada unidad base si `quantity` unidades de la linea cuestan esto cada una
  // y equivalen a `base` unidades base. Una caja de 24 a 12 es 0,5 por unidad.
  perBase(quantity: Quantity, base: Quantity): UnitCost {
    return UnitCost.fromMicros(roundedDivision(this.micros * quantity.units, base.units));
  }

  equals(other: UnitCost): boolean {
    return this.micros === other.micros;
  }

  toNumber(): number {
    return Number(this.micros) / 1_000_000;
  }
}

// Division entera redondeada a la mitad hacia arriba, para cantidades no negativas.
export function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (2n * denominator);
}
