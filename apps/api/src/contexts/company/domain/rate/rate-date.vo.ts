import { InvalidRateDateError } from '../errors/company.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// El dia en que rige una tasa: "2026-09-15". Puede ser futuro: el BCV publica por la tarde la del
// siguiente dia habil. Se compara como texto, que en este formato ordena igual que las fechas.
export class RateDate {
  private constructor(readonly value: string) {}

  static of(value: string): RateDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidRateDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidRateDateError(value);
    }

    return new RateDate(value);
  }
}
