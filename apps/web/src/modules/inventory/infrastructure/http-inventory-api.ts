import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { Adjustment, Movement, Stock } from '../domain/inventory';
import type { AdjustmentInput, InventoryApi } from '../domain/inventory-api';

const BASE = '/api/v1/inventory';

export class HttpInventoryApi implements InventoryApi {
  constructor(private readonly baseUrl: string) {}

  async searchStock(token: string, warehouseId?: string): Promise<Stock[]> {
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';

    return (await this.request<{ stocks: Stock[] }>('GET', `${BASE}/stock${query}`, token)).stocks;
  }

  async searchMovements(token: string, itemId: string, warehouseId?: string): Promise<Movement[]> {
    const query = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '';

    return (await this.request<{ movements: Movement[] }>('GET', `${BASE}/items/${encodeURIComponent(itemId)}/movements${query}`, token))
      .movements;
  }

  async searchAdjustments(token: string): Promise<Adjustment[]> {
    return (await this.request<{ adjustments: Adjustment[] }>('GET', `${BASE}/adjustments`, token)).adjustments;
  }

  async saveAdjustment(token: string, id: string | null, input: AdjustmentInput): Promise<void> {
    // NaN no existe en JSON: se manda como texto y la API senala el campo.
    const lines = input.lines.map((line) => ({
      ...line,
      quantity: Number.isNaN(line.quantity) ? 'NaN' : line.quantity,
      unitCost: line.unitCost !== null && Number.isNaN(line.unitCost) ? 'NaN' : line.unitCost,
    }));
    const body = { ...input, lines };

    if (id) {
      await this.request('PUT', `${BASE}/adjustments/${id}`, token, body);
    } else {
      await this.request('POST', `${BASE}/adjustments`, token, body);
    }
  }

  async confirmAdjustment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/adjustments/${id}/confirm`, token);
  }

  async cancelAdjustment(token: string, id: string): Promise<void> {
    await this.request('PUT', `${BASE}/adjustments/${id}/cancel`, token);
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
