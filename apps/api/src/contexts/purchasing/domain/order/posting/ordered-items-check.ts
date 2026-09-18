import {
  InactivePurchaseItemError,
  PurchaseItemChangedError,
  PurchaseItemNotFoundError,
} from '../../errors/purchasing.errors.js';
import { PurchaseOrder } from '../purchase-order.entity.js';
import { OrderedItems } from './purchase-order-posting.js';

// Confirmar anuncia en camino cantidades en unidad base, comprobadas al revalidar el borrador antes
// de bloquear nada. Si en ese instante el articulo se desactivo o cambio su unidad, la orden no se
// confirma con cantidades viejas: se rechaza igual que un borrador viejo.
export function ensureOrderMatchesCatalog(order: PurchaseOrder, items: OrderedItems): void {
  for (const line of order.lines()) {
    const item = items.item(line.itemId);

    if (!item) throw new PurchaseItemNotFoundError(line.itemId.value);
    if (!item.isActive) throw new InactivePurchaseItemError(line.itemId.value);

    const factor = item.factorOf(line.unitId);

    if (factor === null || !line.quantity.times(factor).equals(line.baseQuantity)) {
      throw new PurchaseItemChangedError(line.itemId.value);
    }
  }
}
