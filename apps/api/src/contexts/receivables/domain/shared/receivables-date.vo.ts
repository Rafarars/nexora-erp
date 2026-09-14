import { FutureReceivablesDateError, InvalidReceivablesDateError } from '../errors/receivables.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

// Un dia del calendario, sin hora ni zona. En este formato se compara como texto.
export class ReceivablesDate {
  private constructor(readonly value: string) {}

  static of(value: string): ReceivablesDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidReceivablesDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidReceivablesDateError(value);
    }

    return new ReceivablesDate(value);
  }

  static fromDate(date: Date): ReceivablesDate {
    return ReceivablesDate.of(date.toISOString().slice(0, 10));
  }

  // Un cobro registra algo que ya paso. Contra el dia UTC del reloj, como ventas.
  ensureNotAfter(now: Date): void {
    if (this.value > now.toISOString().slice(0, 10)) throw new FutureReceivablesDateError(this.value);
  }

  isBefore(other: ReceivablesDate): boolean {
    return this.value < other.value;
  }

  // Dias desde esta fecha hasta otra; negativo si la otra es anterior.
  daysUntil(other: ReceivablesDate): number {
    return Math.round((Date.parse(`${other.value}T00:00:00Z`) - Date.parse(`${this.value}T00:00:00Z`)) / DAY);
  }
}
