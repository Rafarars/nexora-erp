import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const INVENTORY_CATALOG = Symbol('InventoryCatalog');

// Lo que el inventario necesita saber del catalogo, con su propio vocabulario. El
// adaptador lo lee de las tablas del catalogo: si el catalogo cambia por dentro, solo se
// toca el adaptador.
export interface StockableItem {
  id: string;
  sku: string;
  name: string;
  type: 'inventoried' | 'service';
  isActive: boolean;
  units: { unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean }[];
}

export interface StockWarehouse {
  id: string;
  name: string;
  isActive: boolean;
}

export interface InventoryCatalog {
  findItems(tenantId: TenantId, ids: ItemRef[]): Promise<StockableItem[]>;
  findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<StockWarehouse[]>;
}
