import { describe, expect, it } from 'vitest';
import { InactiveSalesItemError, SalesItemChangedError, ServiceNotSellableError } from '../../errors/sales.errors.js';
import { NOW, WATER, aDraftOrder, anAvailability } from '../../testing/sales.mother.js';
import { StockReservation } from './stock-reservation.js';

// El borrador se revalido contra el catalogo antes de bloquear nada: si el articulo cambio en ese
// instante, el pedido no reserva con lo que vio antes.
describe('StockReservation against the item as it is when locked', () => {
  const plenty = { [WATER]: 1000 };

  it('refuses base quantities that no longer match the box of the item', () => {
    const order = aDraftOrder();

    expect(() => new StockReservation().confirm(order, anAvailability(plenty, {}, { factorOf: () => 12 }), NOW)).toThrow(SalesItemChangedError);
    expect(order.currentStatus()).toBe('draft');
  });

  it('refuses an item that was deactivated or became a service', () => {
    expect(() => new StockReservation().confirm(aDraftOrder(), anAvailability(plenty, {}, { isActive: false }), NOW)).toThrow(
      InactiveSalesItemError,
    );
    expect(() => new StockReservation().confirm(aDraftOrder(), anAvailability(plenty, {}, { type: 'service' }), NOW)).toThrow(
      ServiceNotSellableError,
    );
  });

  it('reserves when the item is still as the order saw it', () => {
    const order = aDraftOrder();

    new StockReservation().confirm(order, anAvailability(plenty), NOW);

    expect(order.currentStatus()).toBe('confirmed');
  });
});
