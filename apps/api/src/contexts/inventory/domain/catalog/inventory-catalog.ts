import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const INVENTORY_CATALOG = Symbol('InventoryCatalog');

// Lo que los ajustes y las existencias necesitan de los articulos y las bodegas, con su propio
// vocabulario. Las bodegas viven en el catalogo; los articulos, en este contexto, pero un ajuste
// no carga el agregado: le basta esta vista. Si cambian por dentro, solo se toca el adaptador.
export interface StockableItem {
  id: string;
  sku: string;
  name: string;
  type: 'inventoried' | 'service';
  isActive: boolean;
  units: { unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean; mustBeWhole: boolean }[];
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
