import { ColumnKind, ReportCell } from '../../domain/document/report-document.js';

const DIGITS: Record<ColumnKind, [number, number] | null> = {
  text: null,
  date: null,
  integer: [0, 0],
  amount: [2, 2],
  quantity: [0, 4],
  cost: [2, 6],
};

// Como se lee un valor en papel: coma decimal y miles agrupados, como en la pantalla.
export function formatCell(value: ReportCell, kind: ColumnKind): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;

  const digits = DIGITS[kind];

  if (!digits) return String(value);

  return value.toLocaleString('es-VE', { minimumFractionDigits: digits[0], maximumFractionDigits: digits[1] });
}

export const isNumeric = (kind: ColumnKind) => DIGITS[kind] !== null;
