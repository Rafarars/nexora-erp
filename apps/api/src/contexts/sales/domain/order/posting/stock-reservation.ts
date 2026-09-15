import {
  InactiveSalesItemError,
  InsufficientAvailabilityError,
  SalesItemChangedError,
  SalesItemNotFoundError,
  ServiceNotSellableError,
} from '../../errors/sales.errors.js';
import { ItemRef } from '../../shared/references.vo.js';
import { SalesOrder } from '../sales-order.entity.js';
import { StockAvailability } from './stock-availability.js';

// Confirmar un pedido reserva lo que pide. Disponible es lo que hay menos lo que ya reservaron
// otros pedidos; varias lineas del mismo articulo se suman. Si algo no cabe, no se confirma nada.
export class StockReservation {
  confirm(order: SalesOrder, availability: StockAvailability, now: Date): void {
    ensureLinesMatchCatalog(order, availability);

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

// El borrador se revalido antes de bloquear nada. Si en ese instante el articulo se desactivo o
// cambio su unidad, el pedido no reserva cantidades viejas: se rechaza igual que un borrador viejo.
function ensureLinesMatchCatalog(order: SalesOrder, availability: StockAvailability): void {
  for (const line of order.lines()) {
    const item = availability.item(line.itemId);

    if (!item) throw new SalesItemNotFoundError(line.itemId.value);
    if (!item.isActive) throw new InactiveSalesItemError(line.itemId.value);
    if (item.type === 'service') throw new ServiceNotSellableError(line.itemId.value);

    const factor = item.factorOf(line.unitId);

    if (factor === null || !line.quantity.times(factor).equals(line.baseQuantity)) {
      throw new SalesItemChangedError(line.itemId.value);
    }
  }
}
