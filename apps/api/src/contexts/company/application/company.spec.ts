import { describe, expect, it } from 'vitest';
import { BaseCurrencyLockedError, DecimalPlacesLockedError, InactiveCurrencyError, InvalidTimeZoneError, UnknownCurrencyError } from '../domain/errors/company.errors.js';
import { RETIRED_CURRENCY, TENANT_A, TENANT_B, aSettingsInput } from '../domain/testing/company.mother.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CompanyProfileSearcher } from './search-company-profile/company-profile-searcher.js';
import { CompanySettingsSearcher } from './search-company-settings/company-settings-searcher.js';
import { CompanyScenario, aCompanyScenario } from './testing/company-scenario.js';
import { CompanyProfileUpdater } from './update-company-profile/company-profile-updater.js';
import { CompanySettingsUpdater } from './update-company-settings/company-settings-updater.js';

const settingsOf = (s: CompanyScenario, tenantId = TENANT_A) => new CompanySettingsSearcher(s.settingsFinder, s.currencies, s.clock).run({ tenantId });
const updaterFor = (s: CompanyScenario) => new CompanySettingsUpdater(s.settingsFinder, s.policy, s.settings, s.clock);

describe('company settings', () => {
  it('reads the defaults of a company that never saved them, with today in its time zone', async () => {
    const scenario = aCompanyScenario();
    // Las 02:00 UTC del 16 son las 22:00 del 15 en Caracas.
    scenario.clock.travelTo(new Date('2026-01-16T02:00:00.000Z'));

    expect(await settingsOf(scenario)).toEqual({
      baseCurrency: { code: 'USD', name: 'Dólar estadounidense', symbol: '$', decimals: 2 },
      secondaryCurrency: { code: 'VES', name: 'Bolívar', symbol: 'Bs.', decimals: 2 },
      dualCurrency: true,
      timeZone: 'America/Caracas',
      amountDecimals: 2,
      priceDecimals: 6,
      rateType: 'legal',
      allowsRateOverride: true,
      today: '2026-01-15',
    });
  });

  it('saves new settings for one company only', async () => {
    const scenario = aCompanyScenario();

    await updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ baseCurrency: 'eur', secondaryCurrency: null, timeZone: 'Europe/Madrid', amountDecimals: 3 }) });

    expect(await settingsOf(scenario)).toMatchObject({ baseCurrency: { code: 'EUR' }, secondaryCurrency: null, dualCurrency: false, timeZone: 'Europe/Madrid', amountDecimals: 3 });
    expect(await settingsOf(scenario, TENANT_B)).toMatchObject({ baseCurrency: { code: 'USD' } });
  });

  // Una empresa que trabaja en bolivares pone las dos monedas iguales: no hay nada que convertir.
  it('turns dual currency off when both currencies are the same', async () => {
    const scenario = aCompanyScenario();

    await updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ baseCurrency: 'VES', secondaryCurrency: 'VES' }) });

    expect((await settingsOf(scenario)).dualCurrency).toBe(false);
  });

  it('rejects an unknown time zone before reading anything', async () => {
    await expect(updaterFor(aCompanyScenario()).run({ tenantId: TENANT_A, ...aSettingsInput({ timeZone: 'Marte/Olympus' }) })).rejects.toThrow(InvalidTimeZoneError);
  });

  it('rejects a currency that does not exist', async () => {
    await expect(updaterFor(aCompanyScenario()).run({ tenantId: TENANT_A, ...aSettingsInput({ secondaryCurrency: 'XYZ' }) })).rejects.toThrow(UnknownCurrencyError);
  });

  it('rejects choosing a retired currency', async () => {
    await expect(updaterFor(aCompanyScenario()).run({ tenantId: TENANT_A, ...aSettingsInput({ secondaryCurrency: RETIRED_CURRENCY.code }) })).rejects.toThrow(InactiveCurrencyError);
  });

  // El historico dice lo que dijo en su moneda: con documentos confirmados la principal no cambia.
  it('keeps the base currency once the company has confirmed documents, but lets the rest change', async () => {
    const scenario = aCompanyScenario();
    scenario.activity.tenantsWithDocuments.add(TENANT_A);

    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ baseCurrency: 'EUR' }) })).rejects.toThrow(BaseCurrencyLockedError);
    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ timeZone: 'America/Bogota', secondaryCurrency: 'EUR' }) })).resolves.toBeUndefined();

    expect(await settingsOf(scenario)).toMatchObject({ baseCurrency: { code: 'USD' }, timeZone: 'America/Bogota' });
  });

  // Con menos decimales, una factura que debe 39,60 ya no se podria cobrar entera.
  it('only raises the decimal places once the company has confirmed documents', async () => {
    const scenario = aCompanyScenario();
    scenario.activity.tenantsWithDocuments.add(TENANT_A);

    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ amountDecimals: 0 }) })).rejects.toThrow(DecimalPlacesLockedError);
    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ priceDecimals: 2 }) })).rejects.toThrow(DecimalPlacesLockedError);
    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ amountDecimals: 4 }) })).resolves.toBeUndefined();

    expect(await settingsOf(scenario)).toMatchObject({ amountDecimals: 4 });
  });

  it('lowers the decimal places freely while the company has no confirmed documents', async () => {
    const scenario = aCompanyScenario();

    await expect(updaterFor(scenario).run({ tenantId: TENANT_A, ...aSettingsInput({ amountDecimals: 0, priceDecimals: 2 }) })).resolves.toBeUndefined();
  });

  it('publishes today in the time zone of each company', async () => {
    const scenario = aCompanyScenario();
    scenario.clock.travelTo(new Date('2026-01-16T02:00:00.000Z'));
    await updaterFor(scenario).run({ tenantId: TENANT_B, ...aSettingsInput({ timeZone: 'Europe/Madrid' }) });

    expect(await scenario.calendar.today(TENANT_A)).toBe('2026-01-15');
    expect(await scenario.calendar.today(TENANT_B)).toBe('2026-01-16');
  });
});

describe('company profile', () => {
  it('presents a company that never filled its data with its registered name', async () => {
    expect(await new CompanyProfileSearcher(aCompanyScenario().profileFinder).run({ tenantId: TENANT_A })).toEqual({
      legalName: 'Acme Industrial',
      tradeName: null,
      fiscalId: null,
      address: null,
      phone: null,
      email: null,
    });
  });

  it('saves the data that goes on its documents', async () => {
    const scenario = aCompanyScenario();

    await new CompanyProfileUpdater(scenario.profileFinder, scenario.profiles, scenario.clock).run({
      tenantId: TENANT_A,
      legalName: ' Acme Industrial, C.A. ',
      fiscalId: 'j-40000001-2',
      address: 'Av. Principal, Caracas',
      email: 'administracion@acme.com',
    });

    expect((await scenario.profiles.find(TenantId.of(TENANT_A)))?.toPrimitives()).toMatchObject({
      legalName: 'Acme Industrial, C.A.',
      fiscalId: 'J-40000001-2',
      tradeName: null,
      phone: null,
    });
  });
});
