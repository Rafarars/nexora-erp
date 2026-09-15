import { FutureAdjustmentDateError, InvalidAdjustmentDateError } from '../errors/inventory.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Un dia del calendario, sin hora ni zona: "2026-09-13". Se compara como texto, que en este
// formato ordena igual que las fechas.
export class AdjustmentDate {
  private constructor(readonly value: string) {}

  static of(value: string): AdjustmentDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidAdjustmentDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // El 31 de febrero no existe: Date lo convertiria en marzo sin avisar.
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidAdjustmentDateError(value);
    }

    return new AdjustmentDate(value);
  }

  static fromDate(date: Date): AdjustmentDate {
    return AdjustmentDate.of(date.toISOString().slice(0, 10));
  }

  // Un documento registra algo que ya paso: contra el dia de hoy de la empresa, en su zona horaria.
  ensureNotAfter(today: string): void {
    if (this.value > today) throw new FutureAdjustmentDateError(this.value);
  }
}
