import { InventoryMovement } from '../../movement/inventory-movement.entity.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { ItemStock } from '../item-stock.entity.js';

// El articulo tal como esta en el catalogo, bloqueado mientras dura la publicacion: un cambio del
// articulo espera a que termine, o la publicacion ve el cambio.
export interface LedgerItem {
  isActive: boolean;
  type: 'inventoried' | 'service';
  // El factor de una unidad del articulo, o null si ya no la tiene.
  factorOf(unitId: UnitRef): number | null;
}

// Lo que un trabajo de publicacion recibe ya bloqueado: los articulos y las existencias que el
// documento toca (vacias si el articulo nunca estuvo en esa bodega) y los movimientos que el
// documento ya escribio.
export interface Ledger {
  item(itemId: ItemRef): LedgerItem;
  stock(itemId: ItemRef, warehouseId: WarehouseRef): ItemStock;
  movementsOf(originId: string): InventoryMovement[];
}

export interface StockChanges {
  stocks: ItemStock[];
  movements: InventoryMovement[];
}
