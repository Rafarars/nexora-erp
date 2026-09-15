import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyCode } from '../domain/currency/currency-code.vo.js';
import { DuplicateExchangeRateError } from '../domain/errors/company.errors.js';
import { CompanyProfile } from '../domain/profile/company-profile.entity.js';
import { ExchangeRate, exchangeRateDetailsOf } from '../domain/rate/exchange-rate.entity.js';
import { ExchangeRateFilter } from '../domain/rate/exchange-rate.repository.js';
import { RateDate } from '../domain/rate/rate-date.vo.js';
import { RateType } from '../domain/rate/rate-type.vo.js';
import { CompanySettings, settingsDetailsOf } from '../domain/settings/company-settings.entity.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CURRENCIES, LATER, TENANT_A, TENANT_B, aRate, aRateInput, aSettingsInput, rateId } from '../domain/testing/company.mother.js';
import { CompanyPorts, CompanyPortsHarness } from './company-ports.harness.js';

const tenantA = TenantId.of(TENANT_A);
const tenantB = TenantId.of(TENANT_B);

// UNA suite ejecutada dos veces: contra los dobles en memoria y contra PostgreSQL.
export function describeCompanyPortsContract(implementation: string, createHarness: () => CompanyPortsHarness): void {
  describe(`Company ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: CompanyPorts;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    describe('CompanySettingsRepository', () => {
      it('knows nothing of a company that never saved its settings', async () => {
        expect(await ports.settings.find(tenantA)).toBeNull();
      });

      it('returns what it saved, and saving twice updates', async () => {
        const settings = CompanySettings.defaults(tenantA);
        settings.update(settingsDetailsOf(aSettingsInput({ baseCurrency: 'EUR', secondaryCurrency: null })), LATER);
        await ports.settings.save(settings);
        settings.update(settingsDetailsOf(aSettingsInput({ timeZone: 'Europe/Madrid', secondaryCurrency: null, amountDecimals: 4, rateType: 'manual' })), LATER);
        await ports.settings.save(settings);

        expect((await ports.settings.find(tenantA))?.toPrimitives()).toEqual(settings.toPrimitives());
        expect(await ports.settings.find(tenantB)).toBeNull();
      });
    });

    describe('CompanyProfileRepository', () => {
      it('returns what it saved, only for its company', async () => {
        const profile = CompanyProfile.blank(tenantA, 'Contrato A');
        profile.update({ legalName: 'Contrato A, C.A.', fiscalId: 'J-1', address: 'Caracas', phone: '0212', email: 'a@contrato.com', tradeName: 'A' }, LATER);
        await ports.profiles.save(profile);

        expect((await ports.profiles.find(tenantA))?.toPrimitives()).toEqual(profile.toPrimitives());
        expect(await ports.profiles.find(tenantB)).toBeNull();
      });
    });

    describe('CurrencyCatalog', () => {
      it('lists the currencies of the migration in their order', async () => {
        expect((await ports.currencies.searchAll()).filter((currency) => CURRENCIES.some((known) => known.code === currency.code))).toEqual(CURRENCIES);
      });

      it('finds a currency by its code, and nothing for an unknown one', async () => {
        expect(await ports.currencies.find(CurrencyCode.of('VES'))).toEqual(CURRENCIES[2]);
        expect(await ports.currencies.find(CurrencyCode.of('XYZ'))).toBeNull();
      });
    });

    describe('TenantNames', () => {
      it('tells the registered name of each company', async () => {
        expect(await ports.names.nameOf(tenantA)).toBe('Contrato A');
        expect(await ports.names.nameOf(tenantB)).toBe('Contrato B');
      });
    });

    describe('ExchangeRateRepository', () => {
      const saveAll = async (rates: ExchangeRate[]) => {
        for (const rate of rates) await ports.rates.save(rate);
      };
      const keyOf = (overrides: Parameters<typeof aRateInput>[0]) => exchangeRateDetailsOf(aRateInput(overrides)).key;
      const labels = (rates: ExchangeRate[]) => rates.map(({ key }) => `${key.rateDate.value} ${key.currency.value} ${key.type.value}`);
      const search = async (filter: ExchangeRateFilter) => labels(await ports.rates.search(tenantA, filter));

      it('returns what it saved, corrected and deactivated, only for its company', async () => {
        const rate = aRate(TENANT_A, { source: null }, rateId(1));
        await ports.rates.save(rate);
        rate.correct(exchangeRateDetailsOf(aRateInput({ rate: 1234567.12345678, source: 'Corregida' })), LATER);
        rate.deactivate(LATER);
        await ports.rates.save(rate);

        expect((await ports.rates.find(tenantA, rate.id))?.toPrimitives()).toEqual(rate.toPrimitives());
        expect(await ports.rates.find(tenantB, rate.id)).toBeNull();
      });

      it('finds a rate by currency, date and type whatever its status', async () => {
        const rate = aRate(TENANT_A, {}, rateId(1));
        rate.deactivate(LATER);
        await ports.rates.save(rate);

        expect((await ports.rates.findByKey(tenantA, keyOf({})))?.id.value).toBe(rateId(1));
        expect(await ports.rates.findByKey(tenantA, keyOf({ type: 'manual' }))).toBeNull();
        expect(await ports.rates.findByKey(tenantA, keyOf({ currency: 'EUR' }))).toBeNull();
        expect(await ports.rates.findByKey(tenantA, keyOf({ rateDate: '2026-01-16' }))).toBeNull();
        expect(await ports.rates.findByKey(tenantB, keyOf({}))).toBeNull();
      });

      it('refuses a second rate with the same currency, date and type', async () => {
        await ports.rates.save(aRate(TENANT_A, {}, rateId(1)));

        await expect(ports.rates.save(aRate(TENANT_A, { rate: 40 }, rateId(2)))).rejects.toThrow(DuplicateExchangeRateError);
        await expect(ports.rates.save(aRate(TENANT_A, { type: 'manual' }, rateId(3)))).resolves.toBeUndefined();
        await expect(ports.rates.save(aRate(TENANT_B, {}, rateId(4)))).resolves.toBeUndefined();
      });

      // El 15 de enero de 2026 es jueves, pero sirve igual: sin tasa del dia vale la anterior.
      it('resolves the latest active rate of a series on or before a day, never a later one', async () => {
        const friday = aRate(TENANT_A, { rateDate: '2026-01-14', rate: 36 }, rateId(2));
        await saveAll([
          aRate(TENANT_A, { rateDate: '2026-01-09', rate: 35 }, rateId(1)),
          friday,
          aRate(TENANT_A, { rateDate: '2026-01-16', rate: 37 }, rateId(3)),
          aRate(TENANT_A, { rateDate: '2026-01-15', rate: 99, type: 'manual' }, rateId(4)),
          aRate(TENANT_B, { rateDate: '2026-01-15', rate: 50 }, rateId(5)),
        ]);
        const latest = async (date: string) =>
          (await ports.rates.latestOnOrBefore(tenantA, CurrencyCode.of('USD'), RateType.of('legal'), RateDate.of(date)))?.value() ?? null;

        expect(await latest('2026-01-14')).toBe(36);
        expect(await latest('2026-01-15')).toBe(36);
        expect(await latest('2026-01-08')).toBeNull();

        friday.deactivate(LATER);
        await ports.rates.save(friday);

        expect(await latest('2026-01-15')).toBe(35);
      });

      it('lists the most recent first, filtered by currency, type and dates', async () => {
        await saveAll([
          aRate(TENANT_A, { rateDate: '2026-01-10' }, rateId(1)),
          aRate(TENANT_A, { rateDate: '2026-01-12', currency: 'EUR' }, rateId(2)),
          aRate(TENANT_A, { rateDate: '2026-01-12', type: 'manual' }, rateId(3)),
          aRate(TENANT_A, { rateDate: '2026-01-12' }, rateId(4)),
          aRate(TENANT_B, { rateDate: '2026-01-12' }, rateId(5)),
        ]);

        expect(await search({})).toEqual(['2026-01-12 EUR legal', '2026-01-12 USD legal', '2026-01-12 USD manual', '2026-01-10 USD legal']);
        expect(await search({ currency: CurrencyCode.of('USD'), type: RateType.of('legal') })).toEqual(['2026-01-12 USD legal', '2026-01-10 USD legal']);
        expect(await search({ from: RateDate.of('2026-01-11'), to: RateDate.of('2026-01-12') })).toHaveLength(3);
        expect(await search({ to: RateDate.of('2026-01-11') })).toEqual(['2026-01-10 USD legal']);
      });
    });

    describe('CompanyActivity', () => {
      it('does not count drafts, and counts a confirmed document of that company only', async () => {
        await harness.document(TENANT_A, 'draft');
        expect(await ports.activity.hasConfirmedDocuments(tenantA)).toBe(false);

        await harness.document(TENANT_A, 'confirmed');
        expect(await ports.activity.hasConfirmedDocuments(tenantA)).toBe(true);
        expect(await ports.activity.hasConfirmedDocuments(tenantB)).toBe(false);
      });
    });
  });
}
