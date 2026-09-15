import { PurchaseItemChangedError } from '../../errors/purchasing.errors.js';
import { PurchaseOrderLine } from '../purchase-order-line.js';

// Un borrador guardo sus cantidades base con la caja que el articulo tenia al escribirlo. Si al
// confirmarlo la caja ya es otra, no se recalcula en silencio: 10 cajas pedidas cuando traian 24 no
// pueden anunciarse como 120 sin que nadie lo vea. La persona revisa la orden y la vuelve a guardar.
export function ensureBaseQuantitiesUnchanged(written: PurchaseOrderLine[], today: PurchaseOrderLine[]): void {
  written.forEach((line, index) => {
    if (!line.baseQuantity.equals(today[index].baseQuantity)) throw new PurchaseItemChangedError(line.itemId.value);
  });
}
