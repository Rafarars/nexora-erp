import { ItemId } from '../item/item-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { WarehouseId } from '../warehouse/warehouse-id.vo.js';

export const STOCK_USAGE = Symbol('StockUsage');

// Lo que el catalogo necesita saber del inventario para proteger sus reglas, sin importar
// el contexto de inventario: el adaptador lo pregunta a sus tablas.
export interface StockUsage {
  itemHasStock(tenantId: TenantId, itemId: ItemId): Promise<boolean>;
  itemHasMovements(tenantId: TenantId, itemId: ItemId): Promise<boolean>;
  warehouseHasStock(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean>;
}
