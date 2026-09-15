import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyCode } from '../domain/currency/currency-code.vo.js';
import { CompanyProfile } from '../domain/profile/company-profile.entity.js';
import { CompanySettings, settingsDetailsOf } from '../domain/settings/company-settings.entity.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CURRENCIES, LATER, TENANT_A, TENANT_B, aSettingsInput } from '../domain/testing/company.mother.js';
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
        settings.update(settingsDetailsOf(aSettingsInput({ timeZone: 'Europe/Madrid', secondaryCurrency: null, amountDecimals: 4 })), LATER);
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
