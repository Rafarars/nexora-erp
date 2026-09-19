import { ColumnKind, ReportCell } from './report-document.js';

// Cuantos decimales lleva cada tipo de columna. Los importes no estan aqui: los pone la empresa.
const DIGITS: Record<ColumnKind, [number, number] | null> = {
  text: null,
  date: null,
  integer: [0, 0],
  amount: [2, 2],
  quantity: [0, 4],
  cost: [2, 6],
};

// Los decimales de la empresa mandan sobre el importe. Antes habia un [2, 2] fijo, y una empresa
// con cuatro veia el PDF redondear a dos: sus filas dejaban de sumar el total del mismo documento.
export const digitsFor = (kind: ColumnKind, decimals: number): [number, number] | null =>
  kind === 'amount' ? [decimals, decimals] : DIGITS[kind];

// Como se lee un valor en papel: coma decimal y miles agrupados.
export function formatCell(value: ReportCell, kind: ColumnKind, decimals: number): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;

  const digits = digitsFor(kind, decimals);

  if (!digits) return String(value);

  return value.toLocaleString('es-VE', { minimumFractionDigits: digits[0], maximumFractionDigits: digits[1] });
}

// Un importe suelto, para las lineas que van bajo el titulo: la cabecera y la tabla del mismo
// documento tienen que escribir el numero igual. Antes la cabecera usaba toFixed, que escribe con
// punto y sin agrupar, y la tabla con coma: dos notaciones en un mismo papel.
export const formatAmount = (value: number, decimals: number) => formatCell(value, 'amount', decimals);

export const isNumeric = (kind: ColumnKind) => DIGITS[kind] !== null;
