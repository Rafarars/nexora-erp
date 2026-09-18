import { describe, expect, it } from 'vitest';
import { ItemUnit, ItemUnits } from '../../domain/item/item-units.js';
import {
  CATEGORY_A,
  ITEM_B,
  TAX_A,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_PIECE,
  aCategory,
  aTax,
  aUnit,
  anItem,
} from '../../domain/testing/item.mother.js';
import { anItemScenario } from '../testing/item-scenario.js';
import { ItemSearcher } from './item-searcher.js';

describe('ItemSearcher', () => {
  it('returns each item with the names of what it references and the base unit first', async () => {
    const units = ItemUnits.of([ItemUnit.of(UNIT_BOX, 24, false), ItemUnit.of(UNIT_PIECE, 1, true)]);
    const scenario = anItemScenario({
      categories: [aCategory()],
      taxes: [aTax({ name: 'IVA 16%', rate: 16 })],
      units: [aUnit(), aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' })],
      items: [anItem({ units })],
    });

    const { items } = await new ItemSearcher(scenario.items, scenario.catalog).run({
      tenantId: TENANT_A,
    });

    expect(items).toEqual([
      {
        id: expect.any(String),
        code: 'ART000001',
        sku: 'AGUA-500',
        name: 'Agua mineral 500 ml',
        description: null,
        type: 'inventoried',
        category: { id: CATEGORY_A, name: 'Bebidas' },
        salesTax: { id: TAX_A, name: 'IVA 16%', rate: 16 },
        purchaseTax: { id: TAX_A, name: 'IVA 16%', rate: 16 },
        units: [
          { unitId: UNIT_PIECE, name: 'Unidad', abbreviation: 'un', conversionFactor: 1, isBase: true },
          { unitId: UNIT_BOX, name: 'Caja', abbreviation: 'cja', conversionFactor: 24, isBase: false },
        ],
        isActive: true,
      },
    ]);
  });

  it('never lists an item of another tenant', async () => {
    const scenario = anItemScenario({ items: [anItem({ id: ITEM_B, tenantId: TENANT_B })] });

    const { items } = await new ItemSearcher(scenario.items, scenario.catalog).run({
      tenantId: TENANT_A,
    });

    expect(items).toEqual([]);
  });
});
