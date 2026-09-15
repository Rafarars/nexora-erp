import { describe, expect, it } from 'vitest';
import { CategoryRef, TaxRef, UnitRef } from '../shared/references.vo.js';
import {
  CATEGORY_A,
  CATEGORY_B,
  LATER,
  TAX_A,
  UNIT_BOX,
  UNIT_PIECE,
  anItem,
  baseUnitOnly,
} from '../testing/item.mother.js';
import { ItemName } from './item-name.vo.js';
import { ItemUnit, ItemUnits } from './item-units.js';
import { Item } from './item.entity.js';
import { Sku } from './sku.vo.js';

describe('Item', () => {
  it('survives a round trip to primitives, units included', () => {
    const item = anItem({
      units: ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, 24, false)]),
    });

    expect(Item.fromPrimitives(item.toPrimitives()).toPrimitives()).toEqual(item.toPrimitives());
  });

  it('can have no category and no tax', () => {
    expect(anItem({ categoryId: null, taxId: null }).toPrimitives()).toMatchObject({
      categoryId: null,
      taxId: null,
    });
  });

  it('knows what it uses, so the catalog can refuse to deactivate it', () => {
    const item = anItem();

    expect(item.usesCategory(CategoryRef.of(CATEGORY_A))).toBe(true);
    expect(item.usesCategory(CategoryRef.of(CATEGORY_B))).toBe(false);
    expect(item.usesTax(TaxRef.of(TAX_A))).toBe(true);
    expect(item.usesUnit(UnitRef.of(UNIT_PIECE))).toBe(true);
    expect(item.usesUnit(UnitRef.of(UNIT_BOX))).toBe(false);
  });

  it('without a category, uses no category at all', () => {
    expect(anItem({ categoryId: null }).usesCategory(CategoryRef.of(CATEGORY_A))).toBe(false);
  });

  it('replaces its details on update and keeps its code', () => {
    const item = anItem();

    item.update(
      {
        sku: Sku.of('agua-1l'),
        name: ItemName.of('Agua mineral 1 l'),
        description: '  Botella  ',
        type: 'inventoried',
        categoryId: CategoryRef.of(CATEGORY_B),
        taxId: null,
        units: baseUnitOnly(UNIT_BOX),
      },
      LATER,
    );

    expect(item.toPrimitives()).toMatchObject({
      code: 'ART000001',
      sku: 'AGUA-1L',
      name: 'Agua mineral 1 l',
      description: 'Botella',
      categoryId: CATEGORY_B,
      taxId: null,
      units: [{ unitId: UNIT_BOX, conversionFactor: 1, isBase: true }],
      updatedAt: LATER,
    });
  });

  it('rejects a description longer than a thousand characters', () => {
    expect(() =>
      anItem().update(
        {
          sku: Sku.of('X'),
          name: ItemName.of('X'),
          description: 'x'.repeat(1001),
          type: 'service',
          categoryId: null,
          taxId: null,
          units: baseUnitOnly(),
        },
        LATER,
      ),
    ).toThrow(/longer than 1000/);
  });
});
