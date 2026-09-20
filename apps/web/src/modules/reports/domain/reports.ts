import type { AgingTotals } from '../../receivables/domain/receivables';

export interface Dashboard {
  period: { from: string; to: string };
  currency: string;
  salesThisMonth: number;
  purchasesThisMonth: number;
  collectedThisMonth: number;
  receivableBalance: number;
  overdueBalance: number;
  inventoryValue: number;
  topDebtors: { customer: { id: string; code: string; name: string }; balance: number; overdue: number }[];
  topItems: { item: { id: string; sku: string; name: string }; subtotal: number }[];
}

// Lo que la pantalla necesita para saber si hay mas filas de las que recibio.
export interface ReportPage {
  total: number;
  limit: number;
  offset: number;
  // Cuantas filas lleva esta pagina: cero con total mayor que cero si el desplazamiento se paso.
  rows: number;
  hasMore: boolean;
}

export interface AgingReport {
  asOf: string;
  currency: string;
  decimals: number;
  page: ReportPage;
  customers: { customer: { id: string; code: string; name: string }; aging: AgingTotals }[];
  totals: AgingTotals;
}

export interface StatementReport {
  asOf: string;
  currency: string;
  decimals: number;
  page: ReportPage;
  customer: { id: string; code: string; name: string; fiscalId: string | null; paymentTermDays: number; creditLimit: number | null };
  balance: number;
  overdue: number;
  movements: { date: string; type: 'invoice' | 'payment'; code: string; debit: number; credit: number; balance: number }[];
}

export interface SalesByCustomerReport {
  period: { from: string; to: string };
  currency: string;
  decimals: number;
  page: ReportPage;
  customers: { customer: { id: string; code: string; name: string }; invoices: number; subtotal: number; tax: number; total: number }[];
  totals: { invoices: number; subtotal: number; tax: number; total: number };
}

export interface ValuationReport {
  warehouse: string | null;
  warehouseName: string | null;
  currency: string;
  decimals: number;
  page: ReportPage;
  rows: { warehouse: { id: string; name: string }; item: { id: string; sku: string; name: string }; baseUnit: string; quantity: number; averageCost: number; value: number }[];
  totalValue: number;
}

// Que rotulo lleva el pie de un listado paginado, y si hay que pintarlo. Se pinta tambien cuando
// el desplazamiento se paso del total: ahi no hay filas y sin el no queda ningun enlace para
// volver. El rango va acotado al total, que si no salia "201-120 de 120".
export function pageLabel(page: ReportPage): { visible: boolean; label: string } {
  const visible = page.total > page.limit || page.offset > 0;

  if (page.rows === 0) return { visible, label: `Sin filas en esta página, de ${page.total}` };

  return { visible, label: `${Math.min(page.offset + 1, page.total)}–${Math.min(page.offset + page.rows, page.total)} de ${page.total}` };
}

// Los decimales que configura la empresa, los mismos que escriben el PDF y el Excel: antes la
// pantalla usaba el formateador de compras, con un minimo de dos y un maximo de cuatro fijos.
export function formatReportAmount(value: number, decimals: number): string {
  return value.toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export type ReportName = 'antiguedad' | 'estado-de-cuenta' | 'ventas-por-cliente' | 'valuacion-inventario';
export type ReportFormat = 'pdf' | 'xlsx';

// Del primer dia del mes hasta hoy: lo que se pregunta casi siempre.
export function monthToDate(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 8)}01`, to: today };
}

// El enlace de descarga pasa por el servidor de Next, que agrega el token: el navegador nunca lo ve.
export function downloadHref(report: ReportName, format: ReportFormat, params: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams({ reporte: report, formato: format });

  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);

  return `/reportes/descargar?${query.toString()}`;
}

// Traduce los parametros en espanol de la pantalla a la ruta de la API. Lo que no esta aqui no se
// descarga: la ruta no reenvia cualquier cosa a la API.
export function exportPath(query: URLSearchParams): string | null {
  const format = query.get('formato');

  if (format !== 'pdf' && format !== 'xlsx') return null;

  const params = new URLSearchParams({ format });

  switch (query.get('reporte')) {
    case 'antiguedad':
      return `/api/v1/reports/receivables-aging/export?${params}`;
    case 'estado-de-cuenta': {
      const customer = query.get('cliente');

      return customer ? `/api/v1/reports/customers/${encodeURIComponent(customer)}/statement/export?${params}` : null;
    }
    case 'ventas-por-cliente':
      params.set('from', query.get('desde') ?? '');
      params.set('to', query.get('hasta') ?? '');

      return `/api/v1/reports/sales-by-customer/export?${params}`;
    case 'valuacion-inventario':
      if (query.get('bodega')) params.set('warehouseId', query.get('bodega') ?? '');

      return `/api/v1/reports/inventory-valuation/export?${params}`;
    default:
      return null;
  }
}
