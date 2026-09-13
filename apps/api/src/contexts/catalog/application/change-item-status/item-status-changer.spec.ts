import { describe, expect, it } from 'vitest';
import { InactiveReferenceError } from '../../domain/errors/inactive-reference.error.js';
import { ItemWithStockError } from '../../domain/errors/in-use.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ITEM_A, TENANT_A, aCategory, aTax, aUnit, anItem } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { ItemStatusChanger } from './item-status-changer.js';

const changerFor = (s: CatalogScenario) => new ItemStatusChanger(s.itemFinder, s.references, s.stock, s.items, s.clock);
const isActive = async (s: CatalogScenario) => (await s.items.find(TenantId.of(TENANT_A), ItemId.of(ITEM_A)))?.isActive();

describe('ItemStatusChanger', () => {
  it('deactivates and reactivates an item', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()] });
    const changer = changerFor(scenario);

    await changer.run({ tenantId: TENANT_A, itemId: ITEM_A, active: false });
    expect(await isActive(scenario)).toBe(false);

    await changer.run({ tenantId: TENANT_A, itemId: ITEM_A, active: true });
    expect(await isActive(scenario)).toBe(true);
  });

  // Si no, un articulo reactivado volveria a los selectores con una categoria que ya
  // no se ofrece, y la regla "no desactivar lo que se usa" quedaria burlada.
  it('refuses to reactivate an item whose category is now inactive', async () => {
    const scenario = aCatalogScenario({
      categories: [aCategory({ active: false })],
      taxes: [aTax()],
      units: [aUnit()],
      items: [anItem({ active: false })],
    });

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, itemId: ITEM_A, active: true })).rejects.toThrow(
      InactiveReferenceError,
    );
    expect(await isActive(scenario)).toBe(false);
  });

  it('refuses to deactivate an item that still has stock', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()] });
    scenario.stock.itemsWithStock.add(ITEM_A);

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, itemId: ITEM_A, active: false })).rejects.toThrow(ItemWithStockError);
    expect(await isActive(scenario)).toBe(true);
  });
});
