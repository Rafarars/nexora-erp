import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const SALES_CATALOG = Symbol('SalesCatalog');

// Lo que ventas necesita saber del catalogo, con su propio vocabulario. El adaptador lo
// lee de las tablas del catalogo.
export interface SellableItem {
  id: string;
  sku: string;
  name: string;
  type: 'inventoried' | 'service';
  isActive: boolean;
  // El porcentaje del impuesto del articulo; cero si no tiene.
  taxRate: number;
  units: { unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean }[];
}

export interface SalesWarehouse {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SalesCatalog {
  findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]>;
  findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]>;
}
