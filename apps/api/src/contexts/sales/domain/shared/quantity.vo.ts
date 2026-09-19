import { InvalidSalesQuantityError } from '../errors/sales.errors.js';

// El factor de conversion se guarda con ocho decimales: con menos, la docena no cuadra.
const FACTOR_SCALE = 100_000_000n;
const MAX_UNITS = 999_999_999_999_999_999n;

// Cantidad en diezmilesimas, como entero: lo pedido menos lo recibido tiene que dar
// exactamente cero cuando la orden se completa, y con coma flotante no siempre da.
export class Quantity {
  private constructor(readonly units: bigint) {}

  static of(value: number): Quantity {
    const scaled = Math.round(value * 10_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 10_000) > 1e-6) {
      throw new InvalidSalesQuantityError(value);
    }

    return Quantity.fromUnits(BigInt(scaled), value);
  }

  static fromUnits(units: bigint, original: number = Number(units) / 10_000): Quantity {
    if (units < 0n || units > MAX_UNITS) {
      throw new InvalidSalesQuantityError(original);
    }

    return new Quantity(units);
  }

  static zero(): Quantity {
    return new Quantity(0n);
  }

  plus(other: Quantity): Quantity {
    return Quantity.fromUnits(this.units + other.units);
  }

  // Quien resta decide antes si alcanza: aqui un resultado negativo es un error de programa.
  minus(other: Quantity): Quantity {
    return Quantity.fromUnits(this.units - other.units);
  }

  // A la unidad base con el factor del articulo, que entra con sus ocho decimales: con
  // cuatro, doce piezas de una docena daban 0,9996. El resultado se redondea una sola vez.
  times(factor: number): Quantity {
    const factorUnits = BigInt(Math.round(factor * 100_000_000));

    return Quantity.fromUnits((this.units * factorUnits * 2n + FACTOR_SCALE) / (2n * FACTOR_SCALE));
  }

  // La parte proporcional: si 2 cajas son 48 unidades, 1,5 cajas son 36.
  proportionOf(part: Quantity, whole: Quantity): Quantity {
    return Quantity.fromUnits(roundedDivision(this.units * part.units, whole.units));
  }

  // Una unidad que no admite fracciones exige diezmilesimas exactas de unidad entera.
  isWhole(): boolean {
    return this.units % 10_000n === 0n;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  isGreaterThan(other: Quantity): boolean {
    return this.units > other.units;
  }

  equals(other: Quantity): boolean {
    return this.units === other.units;
  }

  toNumber(): number {
    return Number(this.units) / 10_000;
  }
}

// Division entera redondeada a la mitad hacia arriba, para valores no negativos.
export function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (2n * denominator);
}
