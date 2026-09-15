import { InvalidConversionFactorError } from '../errors/item.errors.js';

// Catorce digitos enteros: lo que cabe en la columna decimal(18,4).
const MAX = 99_999_999_999_999;

// Cuantas unidades base contiene una unidad del articulo: 1 caja = 24 unidades.
export class ConversionFactor {
  private constructor(readonly value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > MAX || !hasAtMostFourDecimals(value)) {
      throw new InvalidConversionFactorError(value);
    }
  }

  static of(value: number): ConversionFactor {
    return new ConversionFactor(value);
  }

  isOne(): boolean {
    return this.value === 1;
  }
}

// La columna guarda cuatro decimales: uno con mas se redondearia en silencio.
function hasAtMostFourDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 10_000) - value * 10_000) < 1e-6;
}
