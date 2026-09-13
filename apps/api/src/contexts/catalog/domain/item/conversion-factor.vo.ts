import { InvalidConversionFactorError } from '../errors/invalid-values.errors.js';
import { hasAtMostFourDecimals } from '../shared/decimal.js';

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
