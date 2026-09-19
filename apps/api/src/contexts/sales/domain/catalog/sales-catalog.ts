import { ItemRef, PriceListRef, WarehouseRef } from '../shared/references.vo.js';
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
  isSellable: boolean;
  // El porcentaje del impuesto del articulo; cero si no tiene.
  taxRate: number;
  units: { unitId: string; abbreviation: string; conversionFactor: number; isBase: boolean; mustBeWhole: boolean }[];
  // Lo que cuesta en cada lista, en la unidad base. Vacio: no hay precio que sugerir.
  prices: { priceListId: string; price: number }[];
  // Piso de venta en la moneda de la empresa; nulo, no hay piso.
  minPrice: number | null;
}

// La lista con la que se cotiza. Su moneda puede no ser la del documento: entonces el precio se
// convierte por el bolivar.
export interface SalesPriceList {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
}

export interface SalesWarehouse {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SalesCatalog {
  findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]>;
  findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]>;
  findPriceList(tenantId: TenantId, id: PriceListRef): Promise<SalesPriceList | null>;
  // La que usa un cliente sin lista propia.
  findDefaultPriceList(tenantId: TenantId): Promise<SalesPriceList | null>;
}
