import { CurrencyCode } from '../currency/currency-code.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ExchangeRateId } from './exchange-rate-id.vo.js';
import { ExchangeRate, ExchangeRateKey } from './exchange-rate.entity.js';
import { RateDate } from './rate-date.vo.js';
import { RateType } from './rate-type.vo.js';

export const EXCHANGE_RATE_REPOSITORY = Symbol('ExchangeRateRepository');

// Un listado sin filtros no crece sin fin: unas 250 tasas por moneda y tipo cada ano.
export const RATE_SEARCH_LIMIT = 500;

export interface ExchangeRateFilter {
  currency?: CurrencyCode;
  type?: RateType;
  from?: RateDate;
  to?: RateDate;
}

export interface ExchangeRateRepository {
  // Una segunda tasa con la misma moneda, fecha y tipo se rechaza con DuplicateExchangeRateError.
  save(rate: ExchangeRate): Promise<void>;
  find(tenantId: TenantId, id: ExchangeRateId): Promise<ExchangeRate | null>;
  // Activa o no: cargar de nuevo la misma combinacion la corrige.
  findByKey(tenantId: TenantId, key: ExchangeRateKey): Promise<ExchangeRate | null>;
  // La activa de esa moneda y tipo con la fecha mas reciente que no pase de `date`.
  latestOnOrBefore(tenantId: TenantId, currency: CurrencyCode, type: RateType, date: RateDate): Promise<ExchangeRate | null>;
  // Las mas recientes primero, luego por moneda y tipo, hasta RATE_SEARCH_LIMIT.
  search(tenantId: TenantId, filter: ExchangeRateFilter): Promise<ExchangeRate[]>;
}
