import { describe, expect, it } from 'vitest';
import { ItemInOpenDocumentsError, ItemUnitInOpenDocumentsError, ItemWithStockError } from '../../errors/in-use.errors.js';
import { MeasurementUnitId } from '../../measurement-unit/measurement-unit-id.vo.js';
import { CATEGORY_A, TAX_A, UNIT_BOX, UNIT_PIECE, anItem } from '../../testing/catalog.mother.js';
import { itemDetailsOf } from '../item-details.js';
import { ItemType } from '../item-type.js';
import { ItemUnit, ItemUnits } from '../item-units.js';
import { ItemCommitments, ensureCanChange, ensureCanDeactivate } from './item-commitments.js';

const boxOf = (factor: number) => ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, factor, false)]);
const item = () => anItem({ units: boxOf(24) });
const nothing: ItemCommitments = { hasStock: false, hasMovements: false, openDocumentUnits: [] };
const openBox: ItemCommitments = { ...nothing, openDocumentUnits: [MeasurementUnitId.of(UNIT_BOX)] };

const details = (units: ItemUnits, type: ItemType = 'inventoried') =>
  itemDetailsOf({ sku: 'AGUA-500', name: 'Agua mineral 500 ml', type, categoryId: CATEGORY_A, taxId: TAX_A, units: units.toPrimitives() });

describe('ensureCanChange', () => {
  it('lets an item with nothing committed change anything', () => {
    expect(() => ensureCanChange(item(), details(boxOf(12), 'service'), nothing)).not.toThrow();
  });

  it('refuses a new factor for a unit that an open document uses', () => {
    expect(() => ensureCanChange(item(), details(boxOf(12)), openBox)).toThrow(ItemUnitInOpenDocumentsError);
  });

  it('accepts the same units written in another order', () => {
    const reordered = ItemUnits.of([ItemUnit.of(UNIT_BOX, 24, false), ItemUnit.of(UNIT_PIECE, 1, true)]);

    expect(() => ensureCanChange(item(), details(reordered), openBox)).not.toThrow();
  });

  it('refuses to become a service while an open document uses it', () => {
    expect(() => ensureCanChange(item(), details(boxOf(24), 'service'), openBox)).toThrow(ItemInOpenDocumentsError);
  });
});

describe('ensureCanDeactivate', () => {
  it('explains the stock first when there are stock and open documents', () => {
    expect(() => ensureCanDeactivate(item(), { ...openBox, hasStock: true })).toThrow(ItemWithStockError);
  });

  it('refuses while open documents use it', () => {
    expect(() => ensureCanDeactivate(item(), openBox)).toThrow(ItemInOpenDocumentsError);
  });

  it('lets an item with nothing committed go', () => {
    expect(() => ensureCanDeactivate(item(), nothing)).not.toThrow();
  });
});
