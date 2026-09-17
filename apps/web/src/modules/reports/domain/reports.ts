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

export interface AgingReport {
  asOf: string;
  currency: string;
  customers: { customer: { id: string; code: string; name: string }; aging: AgingTotals }[];
  totals: AgingTotals;
}

export interface StatementReport {
  asOf: string;
  currency: string;
  customer: { id: string; code: string; name: string; fiscalId: string | null; paymentTermDays: number; creditLimit: number | null };
  balance: number;
  overdue: number;
  movements: { date: string; type: 'invoice' | 'payment'; code: string; debit: number; credit: number; balance: number }[];
}

export interface SalesByCustomerReport {
  period: { from: string; to: string };
  currency: string;
  customers: { customer: { id: string; code: string; name: string }; invoices: number; subtotal: number; tax: number; total: number }[];
  totals: { invoices: number; subtotal: number; tax: number; total: number };
}

export interface ValuationReport {
  warehouse: string | null;
  currency: string;
  rows: { warehouse: { id: string; name: string }; item: { id: string; sku: string; name: string }; baseUnit: string; quantity: number; averageCost: number; value: number }[];
  totalValue: number;
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
