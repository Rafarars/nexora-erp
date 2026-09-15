import { Currency } from '../currency/currency-catalog.js';
import { ExchangeRateId } from '../rate/exchange-rate-id.vo.js';
import { ExchangeRate, ExchangeRateInput, exchangeRateDetailsOf } from '../rate/exchange-rate.entity.js';
import { CompanySettingsInput } from '../settings/company-settings.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';

// Los mismos identificadores de empresa que en access.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const LATER = new Date('2026-01-16T10:00:00.000Z');

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

// Las que trae la migracion, en su orden.
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', decimals: 2, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, isActive: true },
  { code: 'VES', name: 'Bolívar', symbol: 'Bs.', decimals: 2, isActive: true },
];

export const RETIRED_CURRENCY: Currency = { code: 'VEF', name: 'Bolívar fuerte', symbol: 'Bs.F', decimals: 2, isActive: false };

export function aSettingsInput(overrides: Partial<CompanySettingsInput> = {}): CompanySettingsInput {
  return { baseCurrency: 'USD', secondaryCurrency: 'VES', timeZone: 'America/Caracas', amountDecimals: 2, priceDecimals: 6, rateType: 'legal', ...overrides };
}

export const RATE_ID = '0000000a-0000-4000-8000-000000000000';

// Un identificador valido distinto por numero, para sembrar varias tasas.
export const rateId = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

export function aRateInput(overrides: Partial<ExchangeRateInput> = {}): ExchangeRateInput {
  return { currency: 'USD', rateDate: '2026-01-15', type: 'legal', rate: 36.5, source: 'BCV', ...overrides };
}

export function aRate(tenantId = TENANT_A, overrides: Partial<ExchangeRateInput> = {}, id = RATE_ID): ExchangeRate {
  return ExchangeRate.record(ExchangeRateId.of(id), TenantId.of(tenantId), exchangeRateDetailsOf(aRateInput(overrides)), NOW);
}
