import { InsufficientAvailabilityError } from '../../errors/sales.errors.js';
import { ItemRef } from '../../shared/references.vo.js';
import { SalesOrder } from '../sales-order.entity.js';
import { StockAvailability } from './stock-availability.js';

// Confirmar un pedido reserva lo que pide. Disponible es lo que hay menos lo que ya reservaron
// otros pedidos; varias lineas del mismo articulo se suman. Si algo no cabe, no se confirma nada.
export class StockReservation {
  confirm(order: SalesOrder, availability: StockAvailability, now: Date): void {
    for (const [itemId, required] of order.reservedByItem()) {
      const item = ItemRef.of(itemId);
      const onHand = availability.onHand(item, order.warehouseId());
      const reserved = availability.reservedByOthers(item, order.warehouseId());
      const available = reserved.isGreaterThan(onHand) ? 0n : onHand.units - reserved.units;

      if (required.units > available) {
        throw new InsufficientAvailabilityError(itemId, order.warehouseId().value, Number(available) / 10_000, required.toNumber());
      }
    }

    order.confirm(now);
  }
}
