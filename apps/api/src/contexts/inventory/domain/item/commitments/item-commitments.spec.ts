import { describe, expect, it } from 'vitest';
import {
  ItemInOpenDocumentsError,
  ItemStopsBeingTradedError,
  ItemUnitInOpenDocumentsError,
  ItemWithStockError,
} from '../../errors/item.errors.js';
import { UnitRef } from '../../shared/references.vo.js';
import { CATEGORY_A, TAX_A, UNIT_BOX, UNIT_PIECE, anItem } from '../../testing/item.mother.js';
import { itemDetailsOf } from '../item-details.js';
import { ItemType } from '../item-type.js';
import { ItemUnit, ItemUnits } from '../item-units.js';
import { ItemCommitments, ensureCanChange, ensureCanDeactivate } from './item-commitments.js';

const boxOf = (factor: number) => ItemUnits.of([ItemUnit.of(UNIT_PIECE, 1, true), ItemUnit.of(UNIT_BOX, factor, false)]);
const item = () => anItem({ units: boxOf(24) });
const nothing: ItemCommitments = { hasStock: false, hasMovements: false, openDocumentUnits: [], openPurchaseOrders: false, openSalesOrders: false };
const openBox: ItemCommitments = { ...nothing, openDocumentUnits: [UnitRef.of(UNIT_BOX)], openSalesOrders: true };
const openSale: ItemCommitments = { ...nothing, openSalesOrders: true };
const openPurchase: ItemCommitments = { ...nothing, openPurchaseOrders: true };

const details = (units: ItemUnits, type: ItemType = 'inventoried', traded: { isPurchasable?: boolean; isSellable?: boolean } = {}) =>
  itemDetailsOf({ sku: 'AGUA-500', name: 'Agua mineral 500 ml', type, categoryId: CATEGORY_A, salesTaxId: TAX_A, purchaseTaxId: TAX_A, units: units.toPrimitives(), ...traded });

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

  // Dejar de venderlo es, para un pedido vivo, lo mismo que desactivarlo: el borrador que lo
  // lleva ya no se podria confirmar. Manda lo que el articulo comprometio.
  it('refuses to stop selling an item with an open sales order', () => {
    expect(() => ensureCanChange(item(), details(boxOf(24), 'inventoried', { isSellable: false }), openSale)).toThrow(
      ItemStopsBeingTradedError,
    );
  });

  it('refuses to stop buying an item with an open purchase order', () => {
    expect(() => ensureCanChange(item(), details(boxOf(24), 'inventoried', { isPurchasable: false }), openPurchase)).toThrow(
      ItemStopsBeingTradedError,
    );
  });

  // Cada lado mira sus propios documentos: un pedido de venta no impide dejar de comprarlo.
  it('lets an item stop being bought while only a sales order is open', () => {
    expect(() => ensureCanChange(item(), details(boxOf(24), 'inventoried', { isPurchasable: false }), openSale)).not.toThrow();
  });

  it('lets an item stop being sold when nothing is open', () => {
    expect(() => ensureCanChange(item(), details(boxOf(24), 'inventoried', { isSellable: false }), nothing)).not.toThrow();
  });

  // Volver a ofrecerlo nunca estorba a nadie.
  it('lets an item start being sold again with open documents', () => {
    const notSold = anItem({ units: boxOf(24), isSellable: false });

    expect(() => ensureCanChange(notSold, details(boxOf(24), 'inventoried', { isSellable: true }), openSale)).not.toThrow();
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
