import { describe, expect, it } from 'vitest';
import {
  ExchangeRateNotFoundError,
  InactiveCurrencyError,
  InvalidExchangeRateError,
  InvalidRateDateError,
  InvalidRateTypeError,
  LocalCurrencyRateError,
  MissingExchangeRateError,
  UnknownCurrencyError,
} from '../domain/errors/company.errors.js';
import { ExchangeRateInput } from '../domain/rate/exchange-rate.entity.js';
import { RATE_ID, RETIRED_CURRENCY, TENANT_A, TENANT_B, aRate, aRateInput, aSettingsInput } from '../domain/testing/company.mother.js';
import { ExchangeRateStatusChanger } from './change-exchange-rate-status/exchange-rate-status-changer.js';
import { ExchangeRateRecorder } from './record-exchange-rate/exchange-rate-recorder.js';
import { ExchangeRateSearcher } from './search-exchange-rates/exchange-rate-searcher.js';
import { CompanyScenario, aCompanyScenario } from './testing/company-scenario.js';
import { CompanySettingsUpdater } from './update-company-settings/company-settings-updater.js';

const record = (s: CompanyScenario, overrides: Partial<ExchangeRateInput> = {}, tenantId = TENANT_A) =>
  new ExchangeRateRecorder(s.rates, s.ratePolicy, s.ids, s.clock).run({ tenantId, ...aRateInput(overrides) });
const search = (s: CompanyScenario, request: { tenantId?: string; currency?: string; type?: string; date?: string } = {}) =>
  new ExchangeRateSearcher(s.rates, s.resolver, s.settingsFinder, s.currencies, s.clock).run({ tenantId: TENANT_A, ...request });
const changeStatus = (s: CompanyScenario, rateId: string, active: boolean, tenantId = TENANT_A) =>
  new ExchangeRateStatusChanger(s.rateFinder, s.rates, s.clock).run({ tenantId, rateId, active });
const configure = (s: CompanyScenario, overrides: Parameters<typeof aSettingsInput>[0]) =>
  new CompanySettingsUpdater(s.settingsFinder, s.policy, s.settings, s.clock).run({ tenantId: TENANT_A, ...aSettingsInput(overrides) });

// El dolar y el euro de una semana de enero: jueves 15 sin tasa legal del dolar.
async function aWeekOfRates(s: CompanyScenario): Promise<void> {
  await record(s, { rateDate: '2026-01-09', rate: 35 });
  await record(s, { rateDate: '2026-01-14', rate: 36 });
  await record(s, { rateDate: '2026-01-16', rate: 37 });
  await record(s, { rateDate: '2026-01-15', rate: 99, type: 'manual' });
  await record(s, { rateDate: '2026-01-14', rate: 40, currency: 'EUR' });
}

describe('recording exchange rates', () => {
  it('records a rate for one company only', async () => {
    const scenario = aCompanyScenario();

    const { id } = await record(scenario, { currency: 'usd', rate: 36.5, source: ' BCV ' });

    expect((await search(scenario)).rates).toEqual([{ id, currency: 'USD', rateDate: '2026-01-15', type: 'legal', rate: 36.5, source: 'BCV', isActive: true }]);
    expect((await search(scenario, { tenantId: TENANT_B })).rates).toEqual([]);
  });

  // Cargar otra vez la misma combinacion es decir cual es la buena, aunque se hubiera desactivado.
  it('corrects the rate of the same currency, date and type instead of adding another', async () => {
    const scenario = aCompanyScenario();
    const { id } = await record(scenario, { rate: 36.5 });
    await changeStatus(scenario, id, false);

    expect(await record(scenario, { rate: 36.75, source: null })).toEqual({ id });
    expect((await search(scenario)).rates).toEqual([expect.objectContaining({ id, rate: 36.75, source: null, isActive: true })]);

    await record(scenario, { type: 'manual', rate: 40 });
    expect((await search(scenario)).rates).toHaveLength(2);
  });

  it.each<[Partial<ExchangeRateInput>, new (...args: never[]) => Error]>([
    [{ currency: 'VES' }, LocalCurrencyRateError],
    [{ rate: 0 }, InvalidExchangeRateError],
    [{ rate: 36.123456789 }, InvalidExchangeRateError],
    [{ rateDate: '2026-02-30' }, InvalidRateDateError],
    [{ type: 'paralela' }, InvalidRateTypeError],
    [{ currency: 'XYZ' }, UnknownCurrencyError],
    [{ currency: RETIRED_CURRENCY.code }, InactiveCurrencyError],
  ])('rejects %j', async (overrides, error) => {
    const scenario = aCompanyScenario();

    await expect(record(scenario, overrides)).rejects.toThrow(error);
    expect((await search(scenario)).rates).toEqual([]);
  });

  it('still corrects a rate it already had in a currency that was retired', async () => {
    const scenario = aCompanyScenario();
    await scenario.rates.save(aRate(TENANT_A, { currency: RETIRED_CURRENCY.code }));

    expect(await record(scenario, { currency: RETIRED_CURRENCY.code, rate: 4.3 })).toEqual({ id: RATE_ID });
  });
});

describe('changing the status of a rate', () => {
  it('does not find a rate of another company', async () => {
    const scenario = aCompanyScenario();
    const { id } = await record(scenario, {}, TENANT_B);

    await expect(changeStatus(scenario, id, false)).rejects.toThrow(ExchangeRateNotFoundError);
    expect((await search(scenario, { tenantId: TENANT_B })).rates[0].isActive).toBe(true);
  });
});

describe('the rate in force', () => {
  it('is the rate of the day or the last one before it, never a later one, in each series', async () => {
    const scenario = aCompanyScenario();
    await aWeekOfRates(scenario);

    expect(await search(scenario)).toMatchObject({
      date: '2026-01-15',
      rateType: 'legal',
      current: [
        { currency: 'USD', name: 'Dólar estadounidense', rate: 36, rateDate: '2026-01-14' },
        { currency: 'EUR', name: 'Euro', rate: 40, rateDate: '2026-01-14' },
      ],
    });
    expect((await search(scenario, { type: 'manual' })).current).toEqual([
      { currency: 'USD', name: 'Dólar estadounidense', rate: 99, rateDate: '2026-01-15' },
      { currency: 'EUR', name: 'Euro', rate: null, rateDate: null },
    ]);
    expect((await search(scenario, { date: '2026-01-08' })).current[0]).toMatchObject({ rate: null, rateDate: null });
  });

  it('stops using a deactivated rate and goes back to the previous one', async () => {
    const scenario = aCompanyScenario();
    await aWeekOfRates(scenario);
    const thursday = (await search(scenario, { currency: 'USD', type: 'legal' })).rates.find((rate) => rate.rateDate === '2026-01-14');

    await changeStatus(scenario, thursday!.id, false);

    expect((await search(scenario)).current[0]).toMatchObject({ rate: 35, rateDate: '2026-01-09' });
  });

  it('follows the series the company chose for its documents', async () => {
    const scenario = aCompanyScenario();
    await aWeekOfRates(scenario);
    await configure(scenario, { rateType: 'manual' });

    expect(await search(scenario)).toMatchObject({ rateType: 'manual', current: [{ rate: 99 }, { rate: null }] });
  });
});

describe('the rates of a document', () => {
  it('freezes the rate of its currency and the rate of the company currency', async () => {
    const scenario = aCompanyScenario();
    await aWeekOfRates(scenario);

    expect(await scenario.documentRates.forDocument(TENANT_A, 'EUR', '2026-01-15')).toEqual({ currency: 'EUR', exchangeRate: 40, baseCurrency: 'USD', baseExchangeRate: 36 });
    expect(await scenario.documentRates.forDocument(TENANT_A, 'VES', '2026-01-15')).toEqual({ currency: 'VES', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 36 });
  });

  // Mejor no emitir que emitir con tasa 1 y descubrirlo al cierre de mes.
  it('refuses a document without a rate for its currency or for the company currency', async () => {
    const scenario = aCompanyScenario();
    await record(scenario, { currency: 'EUR', rate: 40 });

    await expect(scenario.documentRates.forDocument(TENANT_A, 'EUR', '2026-01-15')).rejects.toThrow(MissingExchangeRateError);
    await expect(scenario.documentRates.forDocument(TENANT_A, 'EUR', '2026-01-14')).rejects.toThrow(MissingExchangeRateError);
  });

  it('uses the internal series when the company chose it', async () => {
    const scenario = aCompanyScenario();
    await aWeekOfRates(scenario);
    await configure(scenario, { rateType: 'manual' });

    expect(await scenario.documentRates.forDocument(TENANT_A, 'USD', '2026-01-15')).toMatchObject({ exchangeRate: 99, baseExchangeRate: 99 });
  });

  it('needs no rate for a company that works in bolivars', async () => {
    const scenario = aCompanyScenario();
    await configure(scenario, { baseCurrency: 'VES', secondaryCurrency: 'VES' });

    expect(await scenario.documentRates.forDocument(TENANT_A, 'VES', '2026-01-15')).toEqual({ currency: 'VES', exchangeRate: 1, baseCurrency: 'VES', baseExchangeRate: 1 });
  });
});
