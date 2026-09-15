import { SalesItemChangedError } from '../../errors/sales.errors.js';
import { SalesOrderLine } from '../sales-order-line.js';

// Un borrador guardo sus cantidades base con la caja que el articulo tenia al escribirlo. Si al
// confirmarlo la caja ya es otra, no se recalcula en silencio: 10 cajas pedidas cuando traian 24 no
// pueden reservarse como 120 sin que nadie lo vea. La persona revisa el pedido y lo vuelve a guardar.
export function ensureBaseQuantitiesUnchanged(written: SalesOrderLine[], today: SalesOrderLine[]): void {
  written.forEach((line, index) => {
    if (!line.baseQuantity.equals(today[index].baseQuantity)) throw new SalesItemChangedError(line.itemId.value);
  });
}
