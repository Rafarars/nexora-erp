import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';

// Lo que un pedido necesita saber para reservar, ya con las existencias bloqueadas: cuanto hay
// y cuanto tienen reservado los DEMAS pedidos confirmados.
export interface StockAvailability {
  onHand(itemId: ItemRef, warehouseId: WarehouseRef): Quantity;
  reservedByOthers(itemId: ItemRef, warehouseId: WarehouseRef): Quantity;
}
