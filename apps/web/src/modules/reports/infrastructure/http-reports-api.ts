import { AccessError } from '../../access/domain/access-error';
import type { AgingReport, Dashboard, SalesByCustomerReport, StatementReport, ValuationReport } from '../domain/reports';

const BASE = '/api/v1/reports';

export class HttpReportsApi {
  constructor(private readonly baseUrl: string) {}

  dashboard(token: string): Promise<Dashboard> {
    return this.json(`${BASE}/dashboard`, token);
  }

  aging(token: string): Promise<AgingReport> {
    return this.json(`${BASE}/receivables-aging`, token);
  }

  statement(token: string, customerId: string): Promise<StatementReport> {
    return this.json(`${BASE}/customers/${encodeURIComponent(customerId)}/statement`, token);
  }

  salesByCustomer(token: string, from: string, to: string): Promise<SalesByCustomerReport> {
    return this.json(`${BASE}/sales-by-customer?${new URLSearchParams({ from, to })}`, token);
  }

  valuation(token: string, warehouseId?: string): Promise<ValuationReport> {
    return this.json(`${BASE}/inventory-valuation${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''}`, token);
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
