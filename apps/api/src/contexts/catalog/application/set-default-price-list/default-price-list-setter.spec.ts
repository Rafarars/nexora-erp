import { describe, expect, it } from 'vitest';
import { InactiveDefaultPriceListError } from '../../domain/errors/price-list.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PRICE_LIST_B, TENANT_A, aPriceList } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { DefaultPriceListSetter } from './default-price-list-setter.js';

const setterFor = (s: CatalogScenario) => new DefaultPriceListSetter(s.priceListFinder, s.defaultPriceList, s.clock);
const defaults = async (s: CatalogScenario) =>
  (await s.priceLists.searchByTenant(TenantId.of(TENANT_A)))
    .filter((priceList) => priceList.isDefault())
    .map((priceList) => priceList.id.value);

describe('DefaultPriceListSetter', () => {
  it('moves the mark and leaves exactly one default', async () => {
    const scenario = aCatalogScenario({
      priceLists: [aPriceList({ isDefault: true }), aPriceList({ id: PRICE_LIST_B, name: 'Detal', code: 'LPR000002' })],
    });

    await setterFor(scenario).run({ tenantId: TENANT_A, priceListId: PRICE_LIST_B });

    expect(await defaults(scenario)).toEqual([PRICE_LIST_B]);
  });

  it('refuses to hand the mark to an inactive price list', async () => {
    const scenario = aCatalogScenario({
      priceLists: [
        aPriceList({ isDefault: true }),
        aPriceList({ id: PRICE_LIST_B, name: 'Detal', code: 'LPR000002', active: false }),
      ],
    });

    await expect(setterFor(scenario).run({ tenantId: TENANT_A, priceListId: PRICE_LIST_B })).rejects.toThrow(
      InactiveDefaultPriceListError,
    );
  });
});
