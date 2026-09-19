import { AccessError } from '../../access/domain/access-error';
import type { AgingReport, Dashboard, SalesByCustomerReport, StatementReport, ValuationReport } from '../domain/reports';

const BASE = '/api/v1/reports';

// El desplazamiento solo viaja cuando no es el principio: asi la primera pagina de cada reporte
// tiene una direccion limpia.
function paged(params: Record<string, string>, offset: number): string {
  const query = new URLSearchParams(params);

  if (offset > 0) query.set('offset', String(offset));

  return query.size > 0 ? `?${query}` : '';
}

export class HttpReportsApi {
  constructor(private readonly baseUrl: string) {}

  dashboard(token: string): Promise<Dashboard> {
    return this.json(`${BASE}/dashboard`, token);
  }

  aging(token: string, offset = 0): Promise<AgingReport> {
    return this.json(`${BASE}/receivables-aging${paged({}, offset)}`, token);
  }

  statement(token: string, customerId: string, offset = 0): Promise<StatementReport> {
    return this.json(`${BASE}/customers/${encodeURIComponent(customerId)}/statement${paged({}, offset)}`, token);
  }

  salesByCustomer(token: string, from: string, to: string, offset = 0): Promise<SalesByCustomerReport> {
    return this.json(`${BASE}/sales-by-customer${paged({ from, to }, offset)}`, token);
  }

  valuation(token: string, warehouseId?: string, offset = 0): Promise<ValuationReport> {
    return this.json(`${BASE}/inventory-valuation${paged(warehouseId ? { warehouseId } : {}, offset)}`, token);
  }

  // La descarga se reenvia tal cual: cabeceras de tipo y nombre de archivo incluidas.
  download(token: string, path: string): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
  }

  private async json<T>(path: string, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      throw AccessError.fromStatus(response.status, { message: String(body.message ?? ''), code: typeof body.error === 'string' ? body.error : '', fields: Array.isArray(body.fields) ? body.fields.map(String) : [] });
    }

    return (await response.json()) as T;
  }
}
