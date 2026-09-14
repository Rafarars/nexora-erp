import { AccessError } from '../../access/domain/access-error';
import { readableReceivablesError } from '../../receivables/domain/receivables-error';

const BY_CODE: Record<string, string> = {
  ReportCustomerNotFoundError: 'Ese cliente ya no existe en esta empresa.',
  ReportWarehouseNotFoundError: 'Esa bodega ya no existe en esta empresa.',
  InvalidReportDateError: 'Una de las fechas no es válida.',
  InvalidReportPeriodError: 'La fecha final es anterior a la inicial.',
  ReportPeriodTooLongError: 'El periodo no puede ser mayor a un año.',
  InvalidExportFormatError: 'Ese formato de descarga no existe.',
};

export function readableReportsError(error: unknown, fallback: string): string {
  if (error instanceof AccessError && BY_CODE[error.code]) return BY_CODE[error.code];

  return readableReceivablesError(error, fallback);
}
