import { ColumnKind } from '../../domain/document/report-document.js';

export { formatCell, formatAmount, isNumeric } from '../../domain/document/report-format.js';

// El formato de celda de Excel: el numero se ve con los decimales de la empresa y sigue siendo un
// numero, para que quien abra el archivo pueda sumarlo y filtrarlo.
export function excelFormat(kind: ColumnKind, decimals: number): string | undefined {
  if (kind === 'amount') return decimals === 0 ? '#,##0' : `#,##0.${'0'.repeat(decimals)}`;

  return { integer: '0', quantity: '#,##0.####', cost: '#,##0.00####' }[kind as 'integer' | 'quantity' | 'cost'];
}
