import { describe, expect, it } from 'vitest';
import {
  DuplicateSkuError,
  InactiveReferenceError,
  ItemInOpenDocumentsError,
  ItemNotFoundError,
  ItemUnitInOpenDocumentsError,
  ItemWithMovementsError,
} from '../../domain/errors/item.errors.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemUnit, ItemUnits } from '../../domain/item/item-units.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import {
  CATEGORY_A,
  CATEGORY_B,
  ITEM_A,
  ITEM_B,
  TAX_A,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_KILO,
  UNIT_PIECE,
  aCategory,
  aTax,
  aUnit,
  anItem,
} from '../../domain/testing/item.mother.js';
import { ItemScenario, anItemScenario } from '../testing/item-scenario.js';
import { ItemUpdater, ItemUpdaterRequest } from './item-updater.js';

const updaterFor = (s: ItemScenario) => new ItemUpdater(s.itemFinder, s.references, s.skuUniqueness, s.barcodeUniqueness, s.itemPosting, s.clock);

function request(overrides: Partial<ItemUpdaterRequest> = {}): ItemUpdaterRequest {
  return {
    tenantId: TENANT_A,
    itemId: ITEM_A,
    sku: 'AGUA-500',
    name: 'Agua mineral 500 ml',
    description: 'Botella de plástico',
    type: 'inventoried',
    categoryId: CATEGORY_A,
    salesTaxId: TAX_A,
    purchaseTaxId: TAX_A,
    units: [{ unitId: UNIT_PIECE, conversionFactor: 1, isBase: true }],
    ...overrides,
  };
}

const scenarioWith = (seed: Parameters<typeof anItemScenario>[0] = {}) =>
  anItemScenario({ categories: [aCategory()], taxes: [aTax()], units: [aUnit()], items: [anItem()], ...seed });

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

  describe('an item with inventory movements', () => {
    const withMovements = () => {
      const scenario = scenarioWith({ units: [aUnit(), aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' })] });
      scenario.itemPosting.itemsWithMovements.add(ITEM_A);
      return scenario;
    };

    // El kardex guarda cantidades en la unidad base: cambiarla reescribiria su historia.
    it('cannot change its base unit', async () => {
      await expect(
        updaterFor(withMovements()).run(request({ units: [{ unitId: UNIT_BOX, conversionFactor: 1, isBase: true }] })),
      ).rejects.toThrow(ItemWithMovementsError);
    });

    it('cannot become a service', async () => {
      await expect(updaterFor(withMovements()).run(request({ type: 'service' }))).rejects.toThrow(ItemWithMovementsError);
    });

    it('can still change its name and add a secondary unit', async () => {
      await expect(
        updaterFor(withMovements()).run(
          request({
            name: 'Agua renombrada',
            units: [
              { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true },
              { unitId: UNIT_BOX, conversionFactor: 24, isBase: false },
            ],
          }),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('an item that open purchase or sales orders use in boxes of 24', () => {
    const piece = { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true };
    const boxOf24 = { unitId: UNIT_BOX, conversionFactor: 24, isBase: false };

    const withOpenBox = () => {
      const scenario = scenarioWith({
        units: [
          aUnit(),
          aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' }),
          aUnit({ id: UNIT_KILO, name: 'Kilogramo', abbreviation: 'kg' }),
        ],
        items: [anItem({ units: ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 24, false)]) })],
      });
      scenario.itemPosting.openDocumentUnits.set(ITEM_A, [UNIT_BOX]);
      return scenario;
    };

    const unitsOf = async (scenario: ItemScenario) =>
      (await scenario.items.find(TenantId.of(TENANT_A), ItemId.of(ITEM_A)))?.toPrimitives().units;

    // La orden guardo 10 cajas como 240 unidades: con una caja de 12 recibiria otra cosa.
    it('cannot change the factor of the box', async () => {
      const scenario = withOpenBox();

      await expect(updaterFor(scenario).run(request({ units: [piece, { ...boxOf24, conversionFactor: 12 }] }))).rejects.toThrow(
        ItemUnitInOpenDocumentsError,
      );
      expect(await unitsOf(scenario)).toContainEqual(boxOf24);
    });

    it('cannot remove the box', async () => {
      await expect(updaterFor(withOpenBox()).run(request({ units: [piece] }))).rejects.toThrow(ItemUnitInOpenDocumentsError);
    });

    // Mover la base a la caja cambia su factor de 24 a 1.
    it('cannot move its base to the box', async () => {
      await expect(
        updaterFor(withOpenBox()).run(
          request({ units: [{ unitId: UNIT_BOX, conversionFactor: 1, isBase: true }, { unitId: UNIT_PIECE, conversionFactor: 0.0417, isBase: false }] }),
        ),
      ).rejects.toThrow(ItemUnitInOpenDocumentsError);
    });

    it('cannot become a service', async () => {
      await expect(updaterFor(withOpenBox()).run(request({ type: 'service', units: [piece, boxOf24] }))).rejects.toThrow(
        ItemInOpenDocumentsError,
      );
    });

    it('can still be renamed and gain another unit', async () => {
      const scenario = withOpenBox();

      await updaterFor(scenario).run(
        request({ name: 'Agua renombrada', units: [piece, boxOf24, { unitId: UNIT_KILO, conversionFactor: 2, isBase: false }] }),
      );

      expect(await unitsOf(scenario)).toHaveLength(3);
    });
  });
});
