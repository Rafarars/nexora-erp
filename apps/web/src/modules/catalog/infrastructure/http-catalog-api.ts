import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import type { Category, MeasurementUnit, Tax, Warehouse } from '../domain/catalog';
import type { CatalogApi } from '../domain/catalog-api';

const BASE = '/api/v1/catalog';

// El unico sitio que conoce las rutas y la forma del JSON del catalogo.
export class HttpCatalogApi implements CatalogApi {
  constructor(private readonly baseUrl: string) {}

  async searchCategories(token: string): Promise<Category[]> {
    return (await this.request<{ categories: Category[] }>('GET', `${BASE}/categories`, token)).categories;
  }

  async saveCategory(token: string, id: string | null, input: { name: string; description: string | null }) {
    await this.save(token, 'categories', id, input);
  }

  async changeCategoryStatus(token: string, id: string, active: boolean) {
    await this.request('PUT', `${BASE}/categories/${id}/status`, token, { active });
  }

  async searchUnits(token: string): Promise<MeasurementUnit[]> {
    return (await this.request<{ units: MeasurementUnit[] }>('GET', `${BASE}/units`, token)).units;
  }

  async saveUnit(token: string, id: string | null, input: { name: string; abbreviation: string }) {
    await this.save(token, 'units', id, input);
  }

  async changeUnitStatus(token: string, id: string, active: boolean) {
    await this.request('PUT', `${BASE}/units/${id}/status`, token, { active });
  }

  async searchTaxes(token: string): Promise<Tax[]> {
    return (await this.request<{ taxes: Tax[] }>('GET', `${BASE}/taxes`, token)).taxes;
  }

  async saveTax(token: string, id: string | null, input: { name: string; rate: number }) {
    // NaN no existe en JSON y viajaria como null: se manda como texto para que la API
    // rechace el campo `rate` en vez de un cuerpo raro.
    await this.save(token, 'taxes', id, { ...input, rate: Number.isNaN(input.rate) ? String(input.rate) : input.rate });
  }

  async changeTaxStatus(token: string, id: string, active: boolean) {
    await this.request('PUT', `${BASE}/taxes/${id}/status`, token, { active });
  }

  async searchWarehouses(token: string): Promise<Warehouse[]> {
    return (await this.request<{ warehouses: Warehouse[] }>('GET', `${BASE}/warehouses`, token)).warehouses;
  }

  async saveWarehouse(token: string, id: string | null, input: { name: string; address: string | null }) {
    await this.save(token, 'warehouses', id, input);
  }

  async changeWarehouseStatus(token: string, id: string, active: boolean) {
    await this.request('PUT', `${BASE}/warehouses/${id}/status`, token, { active });
  }

  async setDefaultWarehouse(token: string, id: string) {
    await this.request('PUT', `${BASE}/warehouses/${id}/default`, token);
  }

  private async save(token: string, resource: string, id: string | null, body: unknown): Promise<void> {
    if (id) {
      await this.request('PUT', `${BASE}/${resource}/${id}`, token, body);
    } else {
      await this.request('POST', `${BASE}/${resource}`, token, body);
    }
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
