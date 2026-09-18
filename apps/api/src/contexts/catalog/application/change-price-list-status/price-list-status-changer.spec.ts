import { describe, expect, it } from 'vitest';
import { DefaultPriceListDeactivationError } from '../../domain/errors/price-list.errors.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PRICE_LIST_A, PRICE_LIST_B, TENANT_A, aPriceList } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { PriceListStatusChanger } from './price-list-status-changer.js';

const changerFor = (s: CatalogScenario) => new PriceListStatusChanger(s.priceListFinder, s.priceLists, s.clock);
const statusOf = async (s: CatalogScenario, id: string) =>
  (await s.priceLists.find(TenantId.of(TENANT_A), PriceListId.of(id)))?.isActive();

describe('PriceListStatusChanger', () => {
  it('deactivates a price list that is not the default one', async () => {
    const scenario = aCatalogScenario({
      priceLists: [aPriceList({ isDefault: true }), aPriceList({ id: PRICE_LIST_B, name: 'Detal', code: 'LPR000002' })],
    });

    await changerFor(scenario).run({ tenantId: TENANT_A, priceListId: PRICE_LIST_B, active: false });

    expect(await statusOf(scenario, PRICE_LIST_B)).toBe(false);
  });

  // Un cliente sin lista propia se cotiza con la de por defecto: apagarla lo dejaria sin precio.
  it('refuses to deactivate the default price list', async () => {
    const scenario = aCatalogScenario({ priceLists: [aPriceList({ isDefault: true })] });

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, priceListId: PRICE_LIST_A, active: false }),
    ).rejects.toThrow(DefaultPriceListDeactivationError);
  });

  it('reactivates a price list', async () => {
    const scenario = aCatalogScenario({ priceLists: [aPriceList({ active: false })] });

    await changerFor(scenario).run({ tenantId: TENANT_A, priceListId: PRICE_LIST_A, active: true });

    expect(await statusOf(scenario, PRICE_LIST_A)).toBe(true);
  });
});
