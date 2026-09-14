import { WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const SALES_STOCK = Symbol('SalesStock');

// Lo que ventas lee de la existencia para mostrar la disponibilidad. El adaptador lee las tablas
// del inventario; reservar de verdad se hace dentro de SalesOrderPosting, con las filas bloqueadas.
export interface SalesStock {
  onHand(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<{ itemId: string; warehouseId: string; quantity: number }[]>;
}
