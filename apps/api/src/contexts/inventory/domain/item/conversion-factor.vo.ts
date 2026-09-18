import { hasAtMostDecimals } from '../../../../shared/domain/amount.js';
import { InvalidConversionFactorError } from '../errors/item.errors.js';

// Diez digitos enteros: lo que cabe en la columna decimal(18,8).
const MAX = 9_999_999_999;

// Cuantas unidades base contiene una unidad del articulo: 1 caja = 24 unidades.
export class ConversionFactor {
  private constructor(readonly value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > MAX || !hasAtMostDecimals(value, 8)) {
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

// La columna guarda ocho decimales: uno con mas se redondearia en silencio. Con ocho, una pieza de
// una base 'docena' es 0,08333333 y doce piezas suman 0,99999996, no 0,9996.
