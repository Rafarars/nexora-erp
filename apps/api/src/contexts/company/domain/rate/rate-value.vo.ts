import { InvalidExchangeRateError } from '../errors/company.errors.js';

// La columna admite diez enteros, pero un number solo guarda quince digitos exactos: con ocho
// decimales, siete enteros es lo que se puede leer y escribir sin perder nada.
export const RATE_MAX = 9_999_999.99999999;

// Cuantos bolivares vale 1 unidad de la moneda. De ahi sale la unica formula: bolivares = monto x tasa.
export class RateValue {
  private constructor(readonly value: number) {}

  static of(value: number): RateValue {
    if (!Number.isFinite(value) || value <= 0 || value > RATE_MAX || Number(value.toFixed(8)) !== value) {
      throw new InvalidExchangeRateError(value, RATE_MAX);
    }

    return new RateValue(value);
  }
}
