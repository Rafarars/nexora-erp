import { InventoryMovement } from '../movement/inventory-movement.entity.js';
import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemStock } from './item-stock.entity.js';

export const STOCK_REPOSITORY = Symbol('StockRepository');

// Lo que la pantalla de existencias ofrece. `text` busca por SKU y por nombre del articulo.
export interface StockCriteria {
  text: string | null;
  warehouseId: string | null;
  // Una fila en cero dice que el articulo paso una vez por esa bodega, no que haya algo.
  includeEmpty: boolean;
  limit: number;
  offset: number;
}

// Solo lectura. Las existencias y el kardex se escriben unicamente a traves de
// AdjustmentPosting, dentro de su transaccion: no hay otro camino para cambiarlas.
export interface StockRepository {
  // TODAS las filas de la empresa. Es para comprobaciones internas y para el contrato, que
  // verifica que la existencia cuadra con su kardex; una pantalla usa `searchPage`.
  searchStocks(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ItemStock[]>;
  // Una pagina, para la pantalla: `total` es cuantas filas cumplen el filtro.
  searchPage(tenantId: TenantId, criteria: StockCriteria): Promise<{ stocks: ItemStock[]; total: number }>;
  searchMovements(tenantId: TenantId, itemId: ItemRef, warehouseId?: WarehouseRef): Promise<InventoryMovement[]>;
}
