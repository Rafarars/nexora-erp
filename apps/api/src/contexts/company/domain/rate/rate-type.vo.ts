import { InvalidRateTypeError } from '../errors/company.errors.js';

// `legal`: la oficial que publica el BCV. `manual`: una interna de la empresa. Son series
// independientes: una no rellena los huecos de la otra.
export const RATE_TYPES = ['legal', 'manual'] as const;

export type RateTypeValue = (typeof RATE_TYPES)[number];

export class RateType {
  private constructor(readonly value: RateTypeValue) {}

  static of(value: string): RateType {
    const known = RATE_TYPES.find((type) => type === value);

    if (!known) throw new InvalidRateTypeError(value);

    return new RateType(known);
  }

  equals(other: RateType): boolean {
    return this.value === other.value;
  }
}
