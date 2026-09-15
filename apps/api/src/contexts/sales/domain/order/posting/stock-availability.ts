import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';

// El articulo tal como esta en el catalogo, bloqueado mientras se reserva.
export interface ReservableItem {
  isActive: boolean;
  type: 'inventoried' | 'service';
  // El factor de una unidad del articulo, o null si ya no la tiene.
  factorOf(unitId: UnitRef): number | null;
}

// Lo que un pedido necesita saber para reservar, ya con articulos y existencias bloqueados:
// cuanto hay, cuanto tienen reservado los DEMAS pedidos confirmados y como esta cada articulo.
export interface StockAvailability {
  onHand(itemId: ItemRef, warehouseId: WarehouseRef): Quantity;
  reservedByOthers(itemId: ItemRef, warehouseId: WarehouseRef): Quantity;
  item(itemId: ItemRef): ReservableItem | null;
}
