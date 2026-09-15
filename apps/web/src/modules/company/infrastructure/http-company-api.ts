import { AccessError } from '../../access/domain/access-error';
import type { AccessErrorBody } from '../../access/domain/access-error';
import { rateFilterQuery } from '../domain/company';
import type { CompanyProfile, CompanySettings, Currency, ExchangeRateBoard, RateFilter } from '../domain/company';
import type { CompanyApi, CompanySettingsInput, ExchangeRateInput } from '../domain/company-api';

// NaN no existe en JSON: se manda como texto y la API senala el campo.
const numeric = (value: number) => (Number.isNaN(value) ? 'NaN' : value);

const BASE = '/api/v1/company';

// El unico sitio que conoce las rutas y la forma del JSON de la empresa.
export class HttpCompanyApi implements CompanyApi {
  constructor(private readonly baseUrl: string) {}

  async profile(token: string): Promise<CompanyProfile> {
    return this.request<CompanyProfile>('GET', `${BASE}/profile`, token);
  }

  async saveProfile(token: string, input: CompanyProfile): Promise<void> {
    await this.request('PUT', `${BASE}/profile`, token, input);
  }

  async settings(token: string): Promise<CompanySettings> {
    return this.request<CompanySettings>('GET', `${BASE}/settings`, token);
  }

  async saveSettings(token: string, input: CompanySettingsInput): Promise<void> {
    await this.request('PUT', `${BASE}/settings`, token, {
      ...input,
      amountDecimals: numeric(input.amountDecimals),
      priceDecimals: numeric(input.priceDecimals),
    });
  }

  async currencies(token: string): Promise<Currency[]> {
    return (await this.request<{ currencies: Currency[] }>('GET', `${BASE}/currencies`, token)).currencies;
  }

  async exchangeRates(token: string, filter: RateFilter): Promise<ExchangeRateBoard> {
    return this.request<ExchangeRateBoard>('GET', `${BASE}/exchange-rates${rateFilterQuery(filter)}`, token);
  }

  async recordRate(token: string, input: ExchangeRateInput): Promise<void> {
    await this.request('PUT', `${BASE}/exchange-rates`, token, { ...input, rate: numeric(input.rate) });
  }

  async changeRateStatus(token: string, id: string, active: boolean): Promise<void> {
    await this.request('PUT', `${BASE}/exchange-rates/${encodeURIComponent(id)}/status`, token, { active });
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
