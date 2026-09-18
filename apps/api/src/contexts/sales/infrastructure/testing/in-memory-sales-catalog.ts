import { SalesPriceList, SalesWarehouse, SellableItem, SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { ItemRef, PriceListRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// El catalogo tal como lo ve ventas, sembrado a mano en cada prueba.
export class InMemorySalesCatalog implements SalesCatalog {
  constructor(
    readonly items: (SellableItem & { tenantId: string })[] = [],
    readonly warehouses: (SalesWarehouse & { tenantId: string })[] = [],
    readonly priceLists: (SalesPriceList & { tenantId: string; isDefault?: boolean })[] = [],
  ) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.items
      .filter((item) => item.tenantId === tenantId.value && wanted.has(item.id))
      .map(({ tenantId: _tenant, ...item }) => structuredClone(item));
  }

  async findPriceList(tenantId: TenantId, id: PriceListRef): Promise<SalesPriceList | null> {
    const found = this.priceLists.find((priceList) => priceList.tenantId === tenantId.value && priceList.id === id.value);

    return found ? strip(found) : null;
  }

  async findDefaultPriceList(tenantId: TenantId): Promise<SalesPriceList | null> {
    const found = this.priceLists.find((priceList) => priceList.tenantId === tenantId.value && priceList.isDefault);

    return found && found.isActive ? strip(found) : null;
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.warehouses
      .filter((warehouse) => warehouse.tenantId === tenantId.value && wanted.has(warehouse.id))
      .map(({ tenantId: _tenant, ...warehouse }) => ({ ...warehouse }));
  }
}

function strip({ id, name, currency, isActive }: SalesPriceList): SalesPriceList {
  return { id, name, currency, isActive };
}
