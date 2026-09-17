import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { AgingTotals, CustomerBalance, Payment, Receivable, Statement } from '../domain/receivables';
import type { PaymentInput, ReceivablesApi } from '../domain/receivables-api';

const BASE = '/api/v1/receivables';

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number) => (Number.isNaN(value) ? 'NaN' : value);

export class HttpReceivablesApi implements ReceivablesApi {
  constructor(private readonly baseUrl: string) {}

  async searchPayments(token: string): Promise<Payment[]> {
    return (await this.request<{ payments: Payment[] }>('GET', `${BASE}/payments`, token)).payments;
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

  async searchReceivables(token: string): Promise<Receivable[]> {
    return (await this.request<{ receivables: Receivable[] }>('GET', `${BASE}/invoices`, token)).receivables;
  }

  async searchCustomerBalances(token: string): Promise<{ customers: CustomerBalance[]; totals: AgingTotals }> {
    return this.request('GET', `${BASE}/customers`, token);
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

async function errorBodyOf(response: Response): Promise<AccessErrorBody> {
  try {
    const body = await response.json();

    return { message: String(body.message ?? ''), code: typeof body.error === 'string' ? body.error : '', fields: Array.isArray(body.fields) ? body.fields.map(String) : [] };
  } catch {
    return {};
  }
}
