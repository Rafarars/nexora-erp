import { TenantId } from '../shared/tenant-id.vo.js';
import { WarehouseId } from '../warehouse/warehouse-id.vo.js';

export const STOCK_USAGE = Symbol('StockUsage');

// Lo que el catalogo necesita saber del inventario para proteger una bodega, sin importar el
// contexto de inventario: el adaptador lo pregunta a sus tablas. Lo de los articulos lo lee
// ItemPosting con la fila del articulo bloqueada.
export interface StockUsage {
  warehouseHasStock(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean>;
}
