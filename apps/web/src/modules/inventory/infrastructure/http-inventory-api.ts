import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { Adjustment, LowStockRow, Movement, Stock } from '../domain/inventory';
import type { AdjustmentInput, InventoryApi, ItemInput, ItemPage } from '../domain/inventory-api';
import type { Item } from '../domain/item';

const BASE = '/api/v1/inventory';

// El tope que admite la API por peticion.
const SELECTOR_PAGE = 50;

export class HttpInventoryApi implements InventoryApi {
  constructor(private readonly baseUrl: string) {}

  async searchItems(token: string, page: { q?: string; limit?: number; offset?: number } = {}): Promise<ItemPage> {
    const query = new URLSearchParams();

    if (page.q) query.set('q', page.q);
    if (page.limit !== undefined) query.set('limit', String(page.limit));
    if (page.offset) query.set('offset', String(page.offset));

    const suffix = query.size > 0 ? `?${query.toString()}` : '';

    return this.request<ItemPage>('GET', `${BASE}/items${suffix}`, token);
  }

  async allItems(token: string): Promise<Item[]> {
    const items: Item[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await this.searchItems(token, { limit: SELECTOR_PAGE, offset });

      items.push(...page.items);
      offset += page.items.length;
      hasMore = page.hasMore && page.items.length > 0;
    }

    return items;
  }

  async searchLowStock(token: string, warehouseId?: string): Promise<LowStockRow[]> {
    const suffix = warehouseId ? `?warehouseId=${warehouseId}` : '';

    return (await this.request<{ rows: LowStockRow[] }>('GET', `${BASE}/low-stock${suffix}`, token)).rows;
  }

  async saveItem(token: string, id: string | null, input: ItemInput): Promise<void> {
    // NaN no existe en JSON: se manda como texto y la API senala el campo.
    const units = input.units.map((unit) => ({
      ...unit,
      conversionFactor: Number.isNaN(unit.conversionFactor) ? 'NaN' : unit.conversionFactor,
    }));
    const prices = input.prices.map((price) => ({ ...price, price: Number.isNaN(price.price) ? 'NaN' : price.price }));
    const minPrice = Number.isNaN(input.minPrice) ? 'NaN' : input.minPrice;
    const body = { ...input, units, prices, minPrice };

    if (id) {
      await this.request('PUT', `${BASE}/items/${id}`, token, body);
    } else {
      await this.request('POST', `${BASE}/items`, token, body);
    }
  }

  async changeItemStatus(token: string, id: string, active: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/items/${id}/status`, token, { active });
  }

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
