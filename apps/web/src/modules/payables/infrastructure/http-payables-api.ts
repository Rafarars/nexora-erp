import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type {
  PaymentFilters,
  PaymentInput,
  PaymentPage,
  PayablesApi,
} from '../domain/payables-api';

const BASE = '/api/v1/payables';

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

export class HttpPayablesApi implements PayablesApi {
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

  private async request<T = void>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) throw AccessError.fromStatus(response.status, await errorBodyOf(response));

    const text = await response.text();

    return (text.length > 0 ? JSON.parse(text) : undefined) as T;
  }
}

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    const body = await response.json();

    return {
      message: String(body.message ?? ''),
      code: typeof body.error === 'string' ? body.error : '',
      fields: Array.isArray(body.fields) ? body.fields.map(String) : [],
    };
  } catch {
    return {};
  }
}
