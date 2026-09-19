import { InvalidExportFormatError } from '../errors/reporting.errors.js';

export const REPORT_RENDERER = Symbol('ReportRenderer');

export const EXPORT_FORMATS = ['pdf', 'xlsx'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Como se muestra y se escribe cada valor. El renderizador decide el formato concreto.
export type ColumnKind = 'text' | 'date' | 'amount' | 'quantity' | 'cost' | 'integer';

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

export type ReportCell = string | number | null;

// Un reporte listo para escribirse, sin saber si sera PDF o Excel. Los reportes lo construyen;
// los renderizadores lo escriben. Asi el contenido se prueba sin abrir ningun archivo.
export interface ReportDocument {
  fileName: string;
  title: string;
  // Lineas bajo el titulo: empresa, fecha de corte, filtros.
  subtitle: string[];
  // Los decimales que configura la empresa. Viaja con el documento porque el PDF y el Excel tienen
  // que ensenar los mismos que la pantalla: si el renderizador fija dos por su cuenta, las filas de
  // una empresa con cuatro dejan de sumar su propio total.
  decimals: number;
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  totals: Record<string, ReportCell> | null;
}

export interface RenderedReport {
  fileName: string;
  contentType: string;
  content: Uint8Array;
}

export interface ReportRenderer {
  render(document: ReportDocument, format: ExportFormat): Promise<RenderedReport>;
}

export function exportFormat(value: string | undefined): ExportFormat {
  if (!EXPORT_FORMATS.includes(value as ExportFormat)) throw new InvalidExportFormatError(String(value));

  return value as ExportFormat;
}
