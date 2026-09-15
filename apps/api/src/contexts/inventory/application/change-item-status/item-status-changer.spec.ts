import { describe, expect, it } from 'vitest';
import {
  InactiveReferenceError,
  ItemInOpenDocumentsError,
  ItemWithStockError,
} from '../../domain/errors/item.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ITEM_A, TENANT_A, UNIT_PIECE, aCategory, aTax, aUnit, anItem } from '../../domain/testing/item.mother.js';
import { ItemScenario, anItemScenario } from '../testing/item-scenario.js';
import { ItemStatusChanger } from './item-status-changer.js';

const changerFor = (s: ItemScenario) => new ItemStatusChanger(s.itemFinder, s.references, s.itemPosting, s.clock);
const isActive = async (s: ItemScenario) => (await s.items.find(TenantId.of(TENANT_A), ItemId.of(ITEM_A)))?.isActive();

describe('ItemStatusChanger', () => {
  it('deactivates and reactivates an item', async () => {
    const scenario = anItemScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()] });
    const changer = changerFor(scenario);

    await changer.run({ tenantId: TENANT_A, itemId: ITEM_A, active: false });
    expect(await isActive(scenario)).toBe(false);

    await changer.run({ tenantId: TENANT_A, itemId: ITEM_A, active: true });
    expect(await isActive(scenario)).toBe(true);
  });

  // Si no, un articulo reactivado volveria a los selectores con una categoria que ya
  // no se ofrece, y la regla "no desactivar lo que se usa" quedaria burlada.
  it('refuses to reactivate an item whose category is now inactive', async () => {
    const scenario = anItemScenario({
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
    const scenario = anItemScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()] });
    scenario.itemPosting.itemsWithStock.add(ITEM_A);

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, itemId: ITEM_A, active: false })).rejects.toThrow(ItemWithStockError);
    expect(await isActive(scenario)).toBe(true);
  });

  // Una orden en camino o un pedido reservado no podrian terminarse con el articulo inactivo.
  it('refuses to deactivate an item that open purchase or sales orders use', async () => {
    const scenario = anItemScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()] });
    scenario.itemPosting.openDocumentUnits.set(ITEM_A, [UNIT_PIECE]);

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, itemId: ITEM_A, active: false })).rejects.toThrow(
      ItemInOpenDocumentsError,
    );
    expect(await isActive(scenario)).toBe(true);
  });
});
