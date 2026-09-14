import { InvalidReportPeriodError, ReportPeriodTooLongError } from '../errors/reporting.errors.js';
import { ReportDate } from '../shared/report-date.vo.js';

const MAX_DAYS = 366;

// Un rango de fechas con ambos extremos incluidos. Un reporte de ventas sin tope barreria todas
// las facturas de la empresa: se limita a un ano.
export class ReportPeriod {
  private constructor(
    readonly from: ReportDate,
    readonly to: ReportDate,
  ) {}

  static of(from: string, to: string): ReportPeriod {
    const start = ReportDate.of(from);
    const end = ReportDate.of(to);

    if (end.value < start.value) throw new InvalidReportPeriodError(from, to);
    if (start.daysUntil(end) + 1 > MAX_DAYS) throw new ReportPeriodTooLongError(from, to, MAX_DAYS);

    return new ReportPeriod(start, end);
  }

  // Del primer dia del mes hasta hoy.
  static monthToDate(today: ReportDate): ReportPeriod {
    return new ReportPeriod(today.firstOfMonth(), today);
  }
}
