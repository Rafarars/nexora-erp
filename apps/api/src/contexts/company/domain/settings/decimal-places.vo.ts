import { InvalidDecimalPlacesError } from '../errors/company.errors.js';

// Cuantos decimales muestra y redondea la empresa. El maximo es el de la columna que lo guarda.
export class DecimalPlaces {
  private constructor(readonly value: number) {}

  static of(value: number, max: number, name: string): DecimalPlaces {
    if (!Number.isInteger(value) || value < 0 || value > max) throw new InvalidDecimalPlacesError(name, value, max);

    return new DecimalPlaces(value);
  }
}
