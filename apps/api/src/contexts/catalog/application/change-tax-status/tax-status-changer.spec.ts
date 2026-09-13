import { describe, expect, it } from 'vitest';
import { TaxInUseError } from '../../domain/errors/in-use.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TaxId } from '../../domain/tax/tax-id.vo.js';
import { TAX_A, TENANT_A, aTax, anItem } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { TaxStatusChanger } from './tax-status-changer.js';

const changerFor = (s: CatalogScenario) => new TaxStatusChanger(s.taxFinder, s.usage, s.taxes, s.clock);

describe('TaxStatusChanger', () => {
  it('refuses to deactivate a tax an active item uses', async () => {
    const scenario = aCatalogScenario({ taxes: [aTax()], items: [anItem()] });

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, taxId: TAX_A, active: false })).rejects.toThrow(TaxInUseError);
  });

  it('deactivates a tax nobody uses', async () => {
    const scenario = aCatalogScenario({ taxes: [aTax()], items: [anItem({ taxId: null })] });

    await changerFor(scenario).run({ tenantId: TENANT_A, taxId: TAX_A, active: false });

    expect((await scenario.taxes.find(TenantId.of(TENANT_A), TaxId.of(TAX_A)))?.isActive()).toBe(false);
  });
});
