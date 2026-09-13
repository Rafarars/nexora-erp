import { InventoryMovement } from '../../movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../../shared/references.vo.js';
import { ItemStock } from '../item-stock.entity.js';

// Lo que un trabajo de publicacion recibe ya bloqueado: las existencias que el documento
// toca (vacias si el articulo nunca estuvo en esa bodega) y los movimientos que el
// documento ya escribio.
export interface Ledger {
  stock(itemId: ItemRef, warehouseId: WarehouseRef): ItemStock;
  movementsOf(originId: string): InventoryMovement[];
}

export interface StockChanges {
  stocks: ItemStock[];
  movements: InventoryMovement[];
}
