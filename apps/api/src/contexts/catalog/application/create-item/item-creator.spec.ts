import { describe, expect, it } from 'vitest';
import { DuplicateSkuError } from '../../domain/errors/duplicate.errors.js';
import { InactiveReferenceError } from '../../domain/errors/inactive-reference.error.js';
import {
  InvalidConversionFactorError,
  InvalidItemTypeError,
  InvalidItemUnitsError,
} from '../../domain/errors/invalid-values.errors.js';
import { CategoryNotFoundError, MeasurementUnitNotFoundError } from '../../domain/errors/not-found.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import {
  CATEGORY_A,
  TAX_A,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_PIECE,
  aCategory,
  aTax,
  aUnit,
  anItem,
} from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { ItemCreator, ItemCreatorRequest } from './item-creator.js';

const creatorFor = (s: CatalogScenario) => new ItemCreator(s.items, s.references, s.skuUniqueness, s.codes, s.ids, s.clock);

function aStockedScenario(seed: Parameters<typeof aCatalogScenario>[0] = {}) {
  return aCatalogScenario({
    categories: [aCategory()],
    taxes: [aTax()],
    units: [aUnit(), aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja', code: 'UOM000002' })],
    ...seed,
  });
}

function request(overrides: Partial<ItemCreatorRequest> = {}): ItemCreatorRequest {
  return {
    tenantId: TENANT_A,
    sku: 'agua-500',
    name: 'Agua mineral 500 ml',
    description: null,
    type: 'inventoried',
    categoryId: CATEGORY_A,
    taxId: TAX_A,
    units: [
      { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true },
      { unitId: UNIT_BOX, conversionFactor: 24, isBase: false },
    ],
    ...overrides,
  };
}

const itemsOf = async (s: CatalogScenario) => (await s.items.searchByTenant(TenantId.of(TENANT_A))).map((i) => i.toPrimitives());

describe('ItemCreator', () => {
  it('creates the item with its units, its code and a normalized SKU', async () => {
    const scenario = aStockedScenario();

    await creatorFor(scenario).run(request());

    expect(await itemsOf(scenario)).toMatchObject([
      {
        code: 'ART000001',
        sku: 'AGUA-500',
        type: 'inventoried',
        categoryId: CATEGORY_A,
        taxId: TAX_A,
        isActive: true,
        units: [
          { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true },
          { unitId: UNIT_BOX, conversionFactor: 24, isBase: false },
        ],
      },
    ]);
  });

  it('creates a service with no category and no tax', async () => {
    const scenario = aStockedScenario();

    await creatorFor(scenario).run(
      request({ sku: 'INST-01', type: 'service', categoryId: null, taxId: null, units: [{ unitId: UNIT_PIECE, conversionFactor: 1, isBase: true }] }),
    );

    expect(await itemsOf(scenario)).toMatchObject([{ type: 'service', categoryId: null, taxId: null }]);
  });

  it('rejects a SKU already used, whatever its case', async () => {
    const scenario = aStockedScenario({ items: [anItem({ sku: 'AGUA-500' })] });

    await expect(creatorFor(scenario).run(request({ sku: 'Agua-500' }))).rejects.toThrow(DuplicateSkuError);
  });

  it('rejects a category of another tenant as missing', async () => {
    const scenario = aStockedScenario({ categories: [aCategory({ tenantId: TENANT_B })] });

    await expect(creatorFor(scenario).run(request())).rejects.toThrow(CategoryNotFoundError);
  });

  it('rejects a unit that does not exist', async () => {
    const scenario = aStockedScenario({ units: [aUnit()] });

    await expect(creatorFor(scenario).run(request())).rejects.toThrow(MeasurementUnitNotFoundError);
  });

  it('rejects an inactive tax', async () => {
    const scenario = aStockedScenario({ taxes: [aTax({ active: false })] });

    await expect(creatorFor(scenario).run(request())).rejects.toThrow(InactiveReferenceError);
  });

  it('rejects units without a base one', async () => {
    await expect(
      creatorFor(aStockedScenario()).run(request({ units: [{ unitId: UNIT_BOX, conversionFactor: 24, isBase: false }] })),
    ).rejects.toThrow(InvalidItemUnitsError);
  });

  it('rejects a negative factor', async () => {
    await expect(
      creatorFor(aStockedScenario()).run(
        request({
          units: [
            { unitId: UNIT_PIECE, conversionFactor: 1, isBase: true },
            { unitId: UNIT_BOX, conversionFactor: -24, isBase: false },
          ],
        }),
      ),
    ).rejects.toThrow(InvalidConversionFactorError);
  });

  it('rejects a type out of scope', async () => {
    await expect(creatorFor(aStockedScenario()).run(request({ type: 'serialized' }))).rejects.toThrow(InvalidItemTypeError);
  });

  // Nada a medias: si algo falla, no queda ni el articulo ni un numero consumido.
  it('stores nothing and consumes no code when something fails', async () => {
    const scenario = aStockedScenario({ taxes: [aTax({ active: false })] });

    await creatorFor(scenario).run(request()).catch(() => undefined);

    expect(await itemsOf(scenario)).toEqual([]);
    expect(await scenario.codes.next(TenantId.of(TENANT_A), 'ART')).toBe(1);
  });
});
