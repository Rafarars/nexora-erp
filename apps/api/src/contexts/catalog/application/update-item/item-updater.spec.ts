import { describe, expect, it } from 'vitest';
import { DuplicateSkuError } from '../../domain/errors/duplicate.errors.js';
import { InactiveReferenceError } from '../../domain/errors/inactive-reference.error.js';
import { ItemNotFoundError } from '../../domain/errors/not-found.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import {
  CATEGORY_A,
  CATEGORY_B,
  ITEM_A,
  ITEM_B,
  TAX_A,
  TENANT_A,
  TENANT_B,
  UNIT_PIECE,
  aCategory,
  aTax,
  aUnit,
  anItem,
} from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { ItemUpdater, ItemUpdaterRequest } from './item-updater.js';

const updaterFor = (s: CatalogScenario) => new ItemUpdater(s.itemFinder, s.references, s.skuUniqueness, s.items, s.clock);

function request(overrides: Partial<ItemUpdaterRequest> = {}): ItemUpdaterRequest {
  return {
    tenantId: TENANT_A,
    itemId: ITEM_A,
    sku: 'AGUA-500',
    name: 'Agua mineral 500 ml',
    description: 'Botella de plástico',
    type: 'inventoried',
    categoryId: CATEGORY_A,
    taxId: TAX_A,
    units: [{ unitId: UNIT_PIECE, conversionFactor: 1, isBase: true }],
    ...overrides,
  };
}

const scenarioWith = (seed: Parameters<typeof aCatalogScenario>[0] = {}) =>
  aCatalogScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()], ...seed });

describe('ItemUpdater', () => {
  it('updates the details and keeps the code', async () => {
    const scenario = scenarioWith();

    await updaterFor(scenario).run(request({ name: 'Agua 500', description: 'Nueva' }));

    const item = await scenario.items.find(TenantId.of(TENANT_A), ItemId.of(ITEM_A));
    expect(item?.toPrimitives()).toMatchObject({ code: 'ART000001', name: 'Agua 500', description: 'Nueva' });
  });

  it('refuses the SKU of another item', async () => {
    const scenario = scenarioWith({ items: [anItem(), anItem({ id: ITEM_B, sku: 'JUGO-1L', code: 'ART000002' })] });

    await expect(updaterFor(scenario).run(request({ itemId: ITEM_B, sku: 'agua-500' }))).rejects.toThrow(DuplicateSkuError);
  });

  // Corregir la descripcion no obliga a cambiar la categoria que se desactivo despues.
  it('keeps a category that was deactivated after the item was created', async () => {
    const scenario = scenarioWith({ categories: [aCategory({ active: false })] });

    await expect(updaterFor(scenario).run(request({ description: 'Corregida' }))).resolves.toBeUndefined();
  });

  it('refuses to switch to an inactive category', async () => {
    const scenario = scenarioWith({
      categories: [aCategory(), aCategory({ id: CATEGORY_B, name: 'Vieja', active: false })],
    });

    await expect(updaterFor(scenario).run(request({ categoryId: CATEGORY_B }))).rejects.toThrow(InactiveReferenceError);
  });

  it('cannot reach an item of another tenant', async () => {
    const scenario = scenarioWith({ items: [anItem({ tenantId: TENANT_B })] });

    await expect(updaterFor(scenario).run(request())).rejects.toThrow(ItemNotFoundError);
  });
});
