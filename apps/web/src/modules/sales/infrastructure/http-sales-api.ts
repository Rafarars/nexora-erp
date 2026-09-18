import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { Availability, Customer, Dispatch, Invoice, SalesOrder } from '../domain/sales';
import type { CustomerInput, DispatchInput, OrderInput, SalesApi } from '../domain/sales-api';

const BASE = '/api/v1/sales';

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number | null) => (value !== null && Number.isNaN(value) ? 'NaN' : value);

export class HttpSalesApi implements SalesApi {
  constructor(private readonly baseUrl: string) {}

  async searchCustomers(token: string): Promise<Customer[]> {
    return (await this.request<{ customers: Customer[] }>('GET', `${BASE}/customers`, token)).customers;
  }

  async saveCustomer(token: string, id: string | null, input: CustomerInput): Promise<void> {
    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/customers/${id}` : `${BASE}/customers`, token, { ...input, paymentTermDays: numeric(input.paymentTermDays), creditLimit: numeric(input.creditLimit) });
  }

  async changeCustomerStatus(token: string, id: string, active: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/customers/${id}/status`, token, { active });
  }

  async searchOrders(token: string): Promise<SalesOrder[]> {
    return (await this.request<{ orders: SalesOrder[] }>('GET', `${BASE}/orders`, token)).orders;
  }

  async saveOrder(token: string, id: string | null, input: OrderInput): Promise<void> {
    const body = {
      ...input,
      exchangeRate: input.exchangeRate === null ? null : numeric(input.exchangeRate),
      lines: input.lines.map((line) => ({ ...line, quantity: numeric(line.quantity), unitPrice: numeric(line.unitPrice) })),
    };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/orders/${id}` : `${BASE}/orders`, token, body);
  }

  async confirmOrder(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/orders/${id}/confirm`, token);
  }

  async cancelOrder(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/orders/${id}/cancel`, token);
  }

  async searchDispatches(token: string): Promise<Dispatch[]> {
    return (await this.request<{ dispatches: Dispatch[] }>('GET', `${BASE}/dispatches`, token)).dispatches;
  }

  async createDispatch(token: string, orderId: string, input: DispatchInput): Promise<void> {
    await this.request('POST', `${BASE}/dispatches`, token, { ...this.dispatchBody(input), orderId });
  }

  async updateDispatch(token: string, id: string, input: DispatchInput): Promise<void> {
    await this.request('PUT', `${BASE}/dispatches/${id}`, token, this.dispatchBody(input));
  }

  async confirmDispatch(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/dispatches/${id}/confirm`, token);
  }

  async cancelDispatch(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/dispatches/${id}/cancel`, token);
  }

  async searchInvoices(token: string): Promise<Invoice[]> {
    return (await this.request<{ invoices: Invoice[] }>('GET', `${BASE}/invoices`, token)).invoices;
  }

  // Un pedido que solo vende servicios se factura sin despacho: no hay nada que sacar.
  async issueInvoice(token: string, origin: { dispatchId: string } | { orderId: string }): Promise<void> {
    await this.request('POST', `${BASE}/invoices`, token, origin);
  }

  async cancelInvoice(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/invoices/${id}/cancel`, token);
  }

  async searchAvailability(token: string, warehouseId?: string): Promise<Availability[]> {
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';

    return (await this.request<{ availability: Availability[] }>('GET', `${BASE}/availability${query}`, token)).availability;
  }

  private dispatchBody(input: DispatchInput) {
    return { ...input, lines: input.lines.map((line) => ({ ...line, quantity: numeric(line.quantity) })) };
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
