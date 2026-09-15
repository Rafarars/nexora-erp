import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { currencyOptions, formatRate, rateCurrencies, rateFilterQuery, timeZoneOptions } from './company';
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

  it('points at the decimals that are not a number', () => {
    expect(readableCompanyError(AccessError.fromStatus(400, { code: 'ValidationError', fields: ['priceDecimals'] }), 'x')).toContain('precios');
  });

  it('uses the fallback for something that is not an API error', () => {
    expect(readableCompanyError(new Error('boom'), 'No se pudo guardar.')).toBe('No se pudo guardar.');
  });
});
