import { describe, expect, it } from 'vitest';
import { InactiveSalesItemError, SalesItemChangedError } from '../../errors/sales.errors.js';
import { NOW, WATER, aDraftOrder, anAvailability } from '../../testing/sales.mother.js';
import { StockReservation } from './stock-reservation.js';

// El borrador se revalido contra el maestro de articulos antes de bloquear nada: si el articulo cambio en ese
// instante, el pedido no reserva con lo que vio antes.
describe('StockReservation against the item as it is when locked', () => {
  const plenty = { [WATER]: 1000 };

  it('refuses base quantities that no longer match the box of the item', () => {
    const order = aDraftOrder();

    expect(() => new StockReservation().confirm(order, anAvailability(plenty, {}, { factorOf: () => 12 }), NOW)).toThrow(SalesItemChangedError);
    expect(order.currentStatus()).toBe('draft');
  });

  it('refuses an item that was deactivated', () => {
    expect(() => new StockReservation().confirm(aDraftOrder(), anAvailability(plenty, {}, { isActive: false }), NOW)).toThrow(
      InactiveSalesItemError,
    );
  });

  // Un servicio se vende: lo que no hace es salir de la bodega, y de eso se ocupa la linea.
  it('accepts an item that became a service', () => {
    expect(() => new StockReservation().confirm(aDraftOrder(), anAvailability(plenty, {}, { type: 'service' }), NOW)).not.toThrow();
  });

  it('reserves when the item is still as the order saw it', () => {
    const order = aDraftOrder();

    new StockReservation().confirm(order, anAvailability(plenty), NOW);

    expect(order.currentStatus()).toBe('confirmed');
  });
});
