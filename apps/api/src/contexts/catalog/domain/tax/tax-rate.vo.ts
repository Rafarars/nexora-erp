import { InvalidTaxRateError } from '../errors/invalid-values.errors.js';
import { hasAtMostFourDecimals } from '../shared/decimal.js';

// Un porcentaje: 16 es el 16 %. Cero es valido y sirve para los articulos exentos.
export class TaxRate {
  private constructor(readonly value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 100 || !hasAtMostFourDecimals(value)) {
      throw new InvalidTaxRateError(value);
    }
  }

  static of(value: number): TaxRate {
    return new TaxRate(value);
  }

  equals(other: TaxRate): boolean {
    return this.value === other.value;
  }
}
