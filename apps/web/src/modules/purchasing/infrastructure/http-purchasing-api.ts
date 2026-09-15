import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { GoodsReceipt, IncomingStock, PurchaseOrder, Supplier } from '../domain/purchasing';
import type { OrderInput, PurchasingApi, ReceiptInput, SupplierInput } from '../domain/purchasing-api';

const BASE = '/api/v1/purchasing';

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number | null) => (value !== null && Number.isNaN(value) ? 'NaN' : value);

export class HttpPurchasingApi implements PurchasingApi {
  constructor(private readonly baseUrl: string) {}

  async searchSuppliers(token: string): Promise<Supplier[]> {
    return (await this.request<{ suppliers: Supplier[] }>('GET', `${BASE}/suppliers`, token)).suppliers;
  }

  async saveSupplier(token: string, id: string | null, input: SupplierInput): Promise<void> {
    const body = { ...input, paymentTermDays: numeric(input.paymentTermDays) };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/suppliers/${id}` : `${BASE}/suppliers`, token, body);
  }

  async changeSupplierStatus(token: string, id: string, active: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/suppliers/${id}/status`, token, { active });
  }

  async searchOrders(token: string): Promise<PurchaseOrder[]> {
    return (await this.request<{ orders: PurchaseOrder[] }>('GET', `${BASE}/orders`, token)).orders;
  }

  async saveOrder(token: string, id: string | null, input: OrderInput): Promise<void> {
    const body = {
      ...input,
      exchangeRate: input.exchangeRate === null ? null : numeric(input.exchangeRate),
      lines: input.lines.map((line) => ({ ...line, quantity: numeric(line.quantity), unitCost: numeric(line.unitCost) })),
    };

    await this.request(id ? 'PUT' : 'POST', id ? `${BASE}/orders/${id}` : `${BASE}/orders`, token, body);
  }

  async confirmOrder(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/orders/${id}/confirm`, token);
  }

  async cancelOrder(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/orders/${id}/cancel`, token);
  }

  async searchReceipts(token: string): Promise<GoodsReceipt[]> {
    return (await this.request<{ receipts: GoodsReceipt[] }>('GET', `${BASE}/receipts`, token)).receipts;
  }

  async createReceipt(token: string, orderId: string, input: ReceiptInput): Promise<void> {
    await this.request('POST', `${BASE}/receipts`, token, { ...this.receiptBody(input), orderId });
  }

  async updateReceipt(token: string, id: string, input: ReceiptInput): Promise<void> {
    await this.request('PUT', `${BASE}/receipts/${id}`, token, this.receiptBody(input));
  }

  async confirmReceipt(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/receipts/${id}/confirm`, token);
  }

  async cancelReceipt(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/receipts/${id}/cancel`, token);
  }

  async searchIncoming(token: string, warehouseId?: string): Promise<IncomingStock[]> {
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';

    return (await this.request<{ incoming: IncomingStock[] }>('GET', `${BASE}/incoming${query}`, token)).incoming;
  }

  private receiptBody(input: ReceiptInput) {
    return {
      ...input,
      exchangeRate: input.exchangeRate === null ? null : numeric(input.exchangeRate),
      lines: input.lines.map((line) => ({ ...line, quantity: numeric(line.quantity) })),
    };
  }

  private async request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw AccessError.fromStatus(response.status, await errorBodyOf(response));
    }

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
