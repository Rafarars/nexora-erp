import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { Customer, SalesOrder } from '../domain/sales';
import type {
  AvailabilityFilters,
  AvailabilityPage,
  CustomerFilters,
  CustomerInput,
  CustomerPage,
  DispatchFilters,
  DispatchInput,
  DispatchPage,
  InvoiceFilters,
  InvoicePage,
  OrderFilters,
  OrderInput,
  OrderPage,
  SalesApi,
} from '../domain/sales-api';

const BASE = '/api/v1/sales';

// El tope que admite la API por peticion.
const SELECTOR_PAGE = 50;

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number | null) => (value !== null && Number.isNaN(value) ? 'NaN' : value);

// Los esquemas son estrictos: solo viaja el filtro que trae valor.
function queryOf(filters: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }

  return query.size > 0 ? `?${query.toString()}` : '';
}

export class HttpSalesApi implements SalesApi {
  constructor(private readonly baseUrl: string) {}

  async searchCustomers(token: string, filters: CustomerFilters = {}): Promise<CustomerPage> {
    return this.request<CustomerPage>('GET', `${BASE}/customers${queryOf(filters)}`, token);
  }

  async allCustomers(token: string): Promise<Customer[]> {
    return everyPage(async (offset) => {
      const page = await this.searchCustomers(token, { limit: SELECTOR_PAGE, offset });

      return { rows: page.customers, hasMore: page.hasMore };
    });
  }

  async saveCustomer(token: string, id: string | null, input: CustomerInput): Promise<void> {
    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/customers/${id}` : `${BASE}/customers`, token, { ...input, paymentTermDays: numeric(input.paymentTermDays), creditLimit: numeric(input.creditLimit) });
  }

  async changeCustomerStatus(token: string, id: string, active: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/customers/${id}/status`, token, { active });
  }

  async searchOrders(token: string, filters: OrderFilters = {}): Promise<OrderPage> {
    return this.request<OrderPage>('GET', `${BASE}/orders${queryOf(filters)}`, token);
  }

  async allOrders(token: string): Promise<SalesOrder[]> {
    return everyPage(async (offset) => {
      const page = await this.searchOrders(token, { limit: SELECTOR_PAGE, offset });

      return { rows: page.orders, hasMore: page.hasMore };
    });
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

  async searchDispatches(token: string, filters: DispatchFilters = {}): Promise<DispatchPage> {
    return this.request<DispatchPage>('GET', `${BASE}/dispatches${queryOf(filters)}`, token);
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

  async searchInvoices(token: string, filters: InvoiceFilters = {}): Promise<InvoicePage> {
    return this.request<InvoicePage>('GET', `${BASE}/invoices${queryOf(filters)}`, token);
  }

  // Un pedido que solo vende servicios se factura sin despacho: no hay nada que sacar.
  async issueInvoice(token: string, origin: { dispatchId: string } | { orderId: string }): Promise<void> {
    await this.request('POST', `${BASE}/invoices`, token, origin);
  }

  async cancelInvoice(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/invoices/${id}/cancel`, token);
  }

  async searchAvailability(token: string, filters: AvailabilityFilters = {}): Promise<AvailabilityPage> {
    return this.request<AvailabilityPage>('GET', `${BASE}/availability${queryOf(filters)}`, token);
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

// Recorre las paginas hasta agotarlas: lo que necesita un selector, que no pagina.
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
