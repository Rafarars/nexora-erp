import { InvalidQuantityError } from '../errors/inventory.errors.js';

// El factor de conversion se guarda con ocho decimales: con menos, la docena no cuadra.
const FACTOR_SCALE = 100_000_000n;
const MAX_UNITS = 999_999_999_999_999_999n;

// Una cantidad en su unidad, guardada como entero de diezmilesimas. Con numeros de coma
// flotante, 0.1 + 0.2 no es 0.3, y "la existencia cuadra con la suma del kardex" dejaria
// de ser verdad por redondeo. Con enteros cuadra exacto.
export class Quantity {
  private constructor(readonly units: bigint) {}

  static of(value: number): Quantity {
    const scaled = Math.round(value * 10_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 10_000) > 1e-6) {
      throw new InvalidQuantityError(value);
    }

    return Quantity.fromUnits(BigInt(scaled), value);
  }

  static fromUnits(units: bigint, original: number = Number(units) / 10_000): Quantity {
    if (units < 0n || units > MAX_UNITS) {
      throw new InvalidQuantityError(original);
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

  // Convierte a la unidad base: 2 cajas por un factor de 24 son 48 unidades. El factor entra
  // con sus ocho decimales; recortarlo a cuatro dejaba la docena en 0,9996 y hacia cero un
  // factor muy fino. El producto se redondea una sola vez, mitad hacia arriba.
  times(factor: number): Quantity {
    const factorUnits = BigInt(Math.round(factor * 100_000_000));

    return Quantity.fromUnits((this.units * factorUnits * 2n + FACTOR_SCALE) / (2n * FACTOR_SCALE));
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
