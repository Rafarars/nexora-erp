import { ItemRef, WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const PURCHASING_CATALOG = Symbol('PurchasingCatalog');

// Lo que compras necesita saber del catalogo, con su propio vocabulario. El adaptador lo
// lee de las tablas del catalogo.
export interface PurchasableItem {
  id: string;
  sku: string;
  name: string;
  type: 'inventoried' | 'service';
  isActive: boolean;
  isPurchasable: boolean;
  // El porcentaje del impuesto del articulo; cero si no tiene.
  taxRate: number;
  units: { unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean; mustBeWhole: boolean }[];
}

export interface PurchaseWarehouse {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PurchasingCatalog {
  findItems(tenantId: TenantId, ids: ItemRef[]): Promise<PurchasableItem[]>;
  findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<PurchaseWarehouse[]>;
}
