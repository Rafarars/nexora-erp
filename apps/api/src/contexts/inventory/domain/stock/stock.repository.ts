import { InventoryMovement } from '../movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemStock } from './item-stock.entity.js';

export const STOCK_REPOSITORY = Symbol('StockRepository');

// Solo lectura. Las existencias y el kardex se escriben unicamente a traves de
// AdjustmentPosting, dentro de su transaccion: no hay otro camino para cambiarlas.
export interface StockRepository {
  searchStocks(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ItemStock[]>;
  searchMovements(tenantId: TenantId, itemId: ItemRef, warehouseId?: WarehouseRef): Promise<InventoryMovement[]>;
}
