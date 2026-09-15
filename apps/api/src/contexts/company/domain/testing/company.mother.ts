import { Currency } from '../currency/currency-catalog.js';
import { CompanySettingsInput } from '../settings/company-settings.entity.js';

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
  return { baseCurrency: 'USD', secondaryCurrency: 'VES', timeZone: 'America/Caracas', amountDecimals: 2, priceDecimals: 6, ...overrides };
}
