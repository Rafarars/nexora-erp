import { InvalidReportDateError } from '../errors/reporting.errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

// Un dia del calendario, sin hora ni zona. En este formato se compara como texto.
export class ReportDate {
  private constructor(readonly value: string) {}

  static of(value: string): ReportDate {
    const match = DATE_PATTERN.exec(value);

    if (!match) throw new InvalidReportDateError(value);

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new InvalidReportDateError(value);
    }

    return new ReportDate(value);
  }

  // El dia UTC del reloj, como en el resto del sistema.
  static fromDate(date: Date): ReportDate {
    return ReportDate.of(date.toISOString().slice(0, 10));
  }

  daysUntil(other: ReportDate): number {
    return Math.round((Date.parse(`${other.value}T00:00:00Z`) - Date.parse(`${this.value}T00:00:00Z`)) / DAY);
  }

  firstOfMonth(): ReportDate {
    return ReportDate.of(`${this.value.slice(0, 8)}01`);
  }
}
