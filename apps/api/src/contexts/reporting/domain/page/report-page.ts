import { InvalidPageError } from '../errors/reporting.errors.js';

// Lo que la pantalla necesita para saber si hay mas: el mismo contrato que usan los listados de
// existencias, compras y ventas.
export interface ReportPage {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export const MAX_REPORT_PAGE = 500;

// Los totales de un reporte cubren SIEMPRE todas las filas, nunca la pagina enviada: un total que
// cambiara al pasar de pagina no serviria para cuadrar nada, que es para lo que existe el reporte.
// Por eso se pagina aqui, despues de sumar, y no en la consulta.
export function pageOf<T>(rows: T[], limit?: number, offset?: number): { rows: T[]; page: ReportPage } {
  // Se valida lo que pide quien llama, no lo que se deduce: sin limite el reporte sale entero, y
  // un reporte vacio no es una pagina invalida.
  if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) throw new InvalidPageError();
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_REPORT_PAGE)) throw new InvalidPageError();

  const from = offset ?? 0;
  const size = limit ?? rows.length;
  const shown = rows.slice(from, from + size);

  return { rows: shown, page: { total: rows.length, limit: size, offset: from, hasMore: from + shown.length < rows.length } };
}
