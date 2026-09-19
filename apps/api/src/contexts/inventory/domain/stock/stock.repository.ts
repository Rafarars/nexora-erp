import { InventoryMovement, MovementOriginType } from '../movement/inventory-movement.entity.js';
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

// Lo que la pantalla del kardex ofrece. El articulo es obligatorio: el kardex es de un
// articulo. Las fechas se comparan contra la que declara el documento, no contra el instante
// de publicacion, que es lo que alguien tiene en la mano cuando busca "lo de agosto".
export interface MovementCriteria {
  itemId: string;
  warehouseId: string | null;
  originType: MovementOriginType | null;
  from: string | null;
  to: string | null;
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
  // TODOS los movimientos de un articulo. Es para comprobaciones internas y para el contrato;
  // una pantalla usa `searchMovementsPage`.
  searchMovements(tenantId: TenantId, itemId: ItemRef, warehouseId?: WarehouseRef): Promise<InventoryMovement[]>;
  // Una pagina del kardex, del mas reciente al mas antiguo dentro de cada bodega.
  searchMovementsPage(tenantId: TenantId, criteria: MovementCriteria): Promise<{ movements: InventoryMovement[]; total: number }>;
}
