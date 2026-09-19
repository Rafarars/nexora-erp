import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { CustomerBalance, Receivable, Statement } from '../domain/receivables';
import type {
  CustomerBalanceFilters,
  CustomerBalancePage,
  PaymentFilters,
  PaymentInput,
  PaymentPage,
  ReceivableFilters,
  ReceivablePage,
  ReceivablesApi,
} from '../domain/receivables-api';

const BASE = '/api/v1/receivables';

// El tope que admite la API por peticion.
const SELECTOR_PAGE = 50;

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number) => (Number.isNaN(value) ? 'NaN' : value);

// Los esquemas son estrictos: solo viaja el filtro que trae valor.
function queryOf(filters: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }

  return query.size > 0 ? `?${query.toString()}` : '';
}

export class HttpReceivablesApi implements ReceivablesApi {
  constructor(private readonly baseUrl: string) {}

  async searchPayments(token: string, filters: PaymentFilters = {}): Promise<PaymentPage> {
    return this.request<PaymentPage>('GET', `${BASE}/payments${queryOf(filters)}`, token);
  }

  async savePayment(token: string, id: string | null, input: PaymentInput): Promise<void> {
    const body = {
      ...input,
      exchangeRate: input.exchangeRate === null ? null : numeric(input.exchangeRate),
      allocations: input.allocations.map((allocation) => ({ ...allocation, amount: numeric(allocation.amount) })),
    };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/payments/${id}` : `${BASE}/payments`, token, body);
  }

  async confirmPayment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/payments/${id}/confirm`, token);
  }

  async cancelPayment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/payments/${id}/cancel`, token);
  }

  async searchReceivables(token: string, filters: ReceivableFilters = {}): Promise<ReceivablePage> {
    return this.request<ReceivablePage>('GET', `${BASE}/invoices${queryOf(filters)}`, token);
  }

  async allReceivables(token: string): Promise<Receivable[]> {
    return everyPage(async (offset) => {
      const page = await this.searchReceivables(token, { limit: SELECTOR_PAGE, offset });

      return { rows: page.receivables, hasMore: page.hasMore };
    });
  }

  async searchCustomerBalances(token: string, filters: CustomerBalanceFilters = {}): Promise<CustomerBalancePage> {
    return this.request<CustomerBalancePage>('GET', `${BASE}/customers${queryOf(filters)}`, token);
  }

  async allCustomers(token: string): Promise<CustomerBalance['customer'][]> {
    const rows = await everyPage(async (offset) => {
      const page = await this.searchCustomerBalances(token, { onlyWithBalance: 'false', limit: SELECTOR_PAGE, offset });

      return { rows: page.customers, hasMore: page.hasMore };
    });

    return rows.map((row) => row.customer);
  }

  async searchStatement(token: string, customerId: string): Promise<Statement> {
    return this.request('GET', `${BASE}/customers/${encodeURIComponent(customerId)}/statement`, token);
  }

  private async request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) throw AccessError.fromStatus(response.status, await errorBodyOf(response));

    const text = await response.text();

    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
  }
}

// Recorre todas las paginas de un listado. Solo para selectores: una pantalla pagina.
async function everyPage<T>(pageAt: (offset: number) => Promise<{ rows: T[]; hasMore: boolean }>): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await pageAt(offset);

    all.push(...page.rows);
    offset += page.rows.length;
    hasMore = page.hasMore && page.rows.length > 0;
  }

  return all;
}

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    const body = await response.json();

    return { message: String(body.message ?? ''), code: typeof body.error === 'string' ? body.error : '', fields: Array.isArray(body.fields) ? body.fields.map(String) : [] };
  } catch {
    return {};
  }
}
