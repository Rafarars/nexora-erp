import { describe, expect, it } from 'vitest';
import { AccessError } from '../../access/domain/access-error';
import { currencyOptions, timeZoneOptions } from './company';
import { readableCompanyError } from './company-error';

const currencies = [
  { code: 'USD', name: 'Dólar', symbol: '$', decimals: 2, isActive: true },
  { code: 'VEF', name: 'Bolívar fuerte', symbol: 'Bs.F', decimals: 2, isActive: false },
];

describe('currencyOptions', () => {
  it('offers the active currencies', () => {
    expect(currencyOptions(currencies, 'USD').map((currency) => currency.code)).toEqual(['USD']);
  });

  // Si no, abrir los parametros de una empresa con una moneda retirada la cambiaria sola.
  it('keeps a retired currency the company already has', () => {
    expect(currencyOptions(currencies, 'USD', 'VEF').map((currency) => currency.code)).toEqual(['USD', 'VEF']);
  });
});

describe('timeZoneOptions', () => {
  it('keeps the current zone even if the server does not list it', () => {
    expect(timeZoneOptions(['America/Caracas'], 'America/Bogota')).toEqual(['America/Bogota', 'America/Caracas']);
    expect(timeZoneOptions(['America/Caracas'], 'America/Caracas')).toEqual(['America/Caracas']);
  });
});

describe('readableCompanyError', () => {
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
