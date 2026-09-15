import { describe, expect, it } from 'vitest';
import { InvalidCurrencyCodeError, InvalidDecimalPlacesError } from '../errors/company.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { LATER, TENANT_A, aSettingsInput } from '../testing/company.mother.js';
import { CompanySettings, settingsDetailsOf } from './company-settings.entity.js';

describe('CompanySettings', () => {
  it('starts with USD and VES, Caracas and two decimals for amounts', () => {
    expect(CompanySettings.defaults(TenantId.of(TENANT_A)).toPrimitives()).toEqual({
      tenantId: TENANT_A,
      baseCurrency: 'USD',
      secondaryCurrency: 'VES',
      timeZone: 'America/Caracas',
      amountDecimals: 2,
      priceDecimals: 6,
      updatedAt: null,
    });
  });

  it('survives a round trip to primitives', () => {
    const settings = CompanySettings.defaults(TenantId.of(TENANT_A));
    settings.update(settingsDetailsOf(aSettingsInput({ secondaryCurrency: null, priceDecimals: 4 })), LATER);

    expect(CompanySettings.fromPrimitives(settings.toPrimitives()).toPrimitives()).toEqual(settings.toPrimitives());
  });

  it.each([
    [{ amountDecimals: 5 }],
    [{ amountDecimals: -1 }],
    [{ priceDecimals: 7 }],
    [{ priceDecimals: 2.5 }],
  ])('rejects decimals out of range: %j', (overrides) => {
    expect(() => settingsDetailsOf(aSettingsInput(overrides))).toThrow(InvalidDecimalPlacesError);
  });

  it('rejects a currency code that is not three letters', () => {
    expect(() => settingsDetailsOf(aSettingsInput({ baseCurrency: 'US$' }))).toThrow(InvalidCurrencyCodeError);
  });

  it('knows whether the base currency changes', () => {
    const settings = CompanySettings.defaults(TenantId.of(TENANT_A));

    expect(settings.changesBaseCurrency(settingsDetailsOf(aSettingsInput({ baseCurrency: 'usd' })))).toBe(false);
    expect(settings.changesBaseCurrency(settingsDetailsOf(aSettingsInput({ baseCurrency: 'EUR' })))).toBe(true);
  });
});
