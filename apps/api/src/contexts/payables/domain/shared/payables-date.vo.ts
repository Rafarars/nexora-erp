import { FuturePayablesDateError, InvalidPayablesDateError } from '../errors/payables.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

// Un dia del calendario, sin hora ni zona. En este formato se compara como texto.
export class PayablesDate {
  private constructor(readonly value: string) {}

  static of(value: string): PayablesDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidPayablesDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidPayablesDateError(value);
    }

    return new PayablesDate(value);
  }

  static fromDate(date: Date): PayablesDate {
    return PayablesDate.of(date.toISOString().slice(0, 10));
  }

  // Un documento registra algo que ya paso: contra el dia de hoy de la empresa, en su zona horaria.
  ensureNotAfter(today: string): void {
    if (this.value > today) throw new FuturePayablesDateError(this.value);
  }

  isBefore(other: PayablesDate): boolean {
    return this.value < other.value;
  }

  // Dias desde esta fecha hasta otra; negativo si la otra es anterior.
  daysUntil(other: PayablesDate): number {
    return Math.round((Date.parse(`${other.value}T00:00:00Z`) - Date.parse(`${this.value}T00:00:00Z`)) / DAY);
  }
}
