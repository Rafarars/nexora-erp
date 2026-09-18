import { describe, expect, it } from 'vitest';
import {
  InactivePurchaseItemError,
  PurchaseItemChangedError,
  PurchaseItemNotFoundError,
} from '../../errors/purchasing.errors.js';
import { BOX, aDraftOrder } from '../../testing/purchasing.mother.js';
import { ensureOrderMatchesCatalog } from './ordered-items-check.js';
import { OrderedItems } from './purchase-order-posting.js';

// Los articulos como estan al bloquearlos: por defecto, activos y con la caja de 24 que la orden vio.
function itemsLike(overrides: { isActive?: boolean; type?: 'inventoried' | 'service'; boxFactor?: number | null } = {}): OrderedItems {
  return {
    item: () => ({
      isActive: overrides.isActive ?? true,
      type: overrides.type ?? 'inventoried',
      factorOf: (unitId) => (unitId.value === BOX ? (overrides.boxFactor === undefined ? 24 : overrides.boxFactor) : 1),
    }),
  };
}

describe('ensureOrderMatchesCatalog', () => {
  it('lets through an order whose items are as it saw them', () => {
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), itemsLike())).not.toThrow();
  });

  // 10 cajas guardadas como 240: con una caja de 12, la orden anunciaria en camino lo que no es.
  it('refuses base quantities that no longer match the box, or a box that is gone', () => {
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), itemsLike({ boxFactor: 12 }))).toThrow(PurchaseItemChangedError);
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), itemsLike({ boxFactor: null }))).toThrow(PurchaseItemChangedError);
  });

  it('refuses an item that was deactivated or no longer exists', () => {
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), itemsLike({ isActive: false }))).toThrow(InactivePurchaseItemError);
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), { item: () => null })).toThrow(PurchaseItemNotFoundError);
  });

  // Un servicio se compra: lo que no hace es entrar a la bodega, y de eso se ocupa la linea.
  it('accepts an item that became a service', () => {
    expect(() => ensureOrderMatchesCatalog(aDraftOrder(), itemsLike({ type: 'service' }))).not.toThrow();
  });
});
