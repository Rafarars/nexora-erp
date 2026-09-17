import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { currencyOptions, formatRate, inBolivars, offersManualRate, rateCurrencies, rateFilterQuery, timeZoneOptions } from './company';
import { readableCompanyError } from './company-error';

const currencies = [
  { code: 'USD', name: 'Dólar', symbol: '$', decimals: 2, isActive: true },
  { code: 'VEF', name: 'Bolívar fuerte', symbol: 'Bs.F', decimals: 2, isActive: false },
  { code: 'VES', name: 'Bolívar', symbol: 'Bs.', decimals: 2, isActive: true },
];

describe('currencyOptions', () => {
  it('offers the active currencies', () => {
    expect(currencyOptions(currencies, 'USD').map((currency) => currency.code)).toEqual(['USD', 'VES']);
  });

  // Si no, abrir los parametros de una empresa con una moneda retirada la cambiaria sola.
  it('keeps a retired currency the company already has', () => {
    expect(currencyOptions(currencies, 'USD', 'VEF').map((currency) => currency.code)).toEqual(['USD', 'VEF', 'VES']);
  });
});

describe('timeZoneOptions', () => {
  it('keeps the current zone even if the server does not list it', () => {
    expect(timeZoneOptions(['America/Caracas'], 'America/Bogota')).toEqual(['America/Bogota', 'America/Caracas']);
    expect(timeZoneOptions(['America/Caracas'], 'America/Caracas')).toEqual(['America/Caracas']);
  });
});

describe('exchange rates', () => {
  // El bolivar vale siempre 1: ofrecerlo seria invitar a un rechazo.
  it('offers a rate only for the active foreign currencies', () => {
    expect(rateCurrencies(currencies).map((currency) => currency.code)).toEqual(['USD']);
  });

  it('shows a rate with a decimal comma, at least two decimals and up to eight', () => {
    expect(formatRate(36.5)).toBe('36,50');
    expect(formatRate(1234567.12345678)).toBe('1234567,12345678');
  });

  it('puts in the URL only the filters that have a value', () => {
    expect(rateFilterQuery({ currency: 'USD', type: '', from: '2026-09-01' })).toBe('?currency=USD&from=2026-09-01');
    expect(rateFilterQuery({})).toBe('');
  });
});

describe('readableCompanyError', () => {
  it('explains that the bolivar takes no rate, and points at a rate that is not a number', () => {
    expect(readableCompanyError(AccessError.fromStatus(400, { code: 'LocalCurrencyRateError' }), 'x')).toContain('bolívar');
    expect(readableCompanyError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['rate'] }), 'x')).toContain('36,50');
  });

  it('explains why the base currency cannot change', () => {
    expect(readableCompanyError(AccessError.fromStatus(409, { code: 'BaseCurrencyLockedError' }), 'x')).toContain('documentos confirmados');
  });

  it('explains why the decimal places cannot go down', () => {
    expect(readableCompanyError(AccessError.fromStatus(409, { code: 'DecimalPlacesLockedError' }), 'x')).toContain('solo pueden aumentar');
  });

  it('points at the decimals that are not a number', () => {
    expect(readableCompanyError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['priceDecimals'] }), 'x')).toContain('precios');
  });

  it('uses the fallback for something that is not an API error', () => {
    expect(readableCompanyError(new Error('boom'), 'No se pudo guardar.')).toBe('No se pudo guardar.');
  });
});

describe('document currency', () => {
  const dollars = { currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false };

  it('says what an amount is worth in bolivars with the rate the document froze', () => {
    expect(inBolivars(139.2, dollars)).toBe(5080.8);
    expect(inBolivars(100, { ...dollars, currency: 'VES', exchangeRate: 1 })).toBe(100);
    expect(inBolivars(100, { ...dollars, exchangeRate: null, baseExchangeRate: null })).toBeNull();
  });

  it('offers writing the rate only for a foreign currency other than the company one, if allowed', () => {
    expect(offersManualRate('EUR', 'USD', true)).toBe(true);
    expect(offersManualRate('USD', 'USD', true)).toBe(false);
    expect(offersManualRate('VES', 'USD', true)).toBe(false);
    expect(offersManualRate('EUR', 'USD', false)).toBe(false);
  });
});
