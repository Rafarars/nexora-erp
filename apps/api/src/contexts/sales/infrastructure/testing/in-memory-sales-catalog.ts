import { SalesWarehouse, SellableItem, SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// El catalogo tal como lo ve ventas, sembrado a mano en cada prueba.
export class InMemorySalesCatalog implements SalesCatalog {
  constructor(
    readonly items: (SellableItem & { tenantId: string })[] = [],
    readonly warehouses: (SalesWarehouse & { tenantId: string })[] = [],
  ) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<SellableItem[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.items
      .filter((item) => item.tenantId === tenantId.value && wanted.has(item.id))
      .map(({ tenantId: _tenant, ...item }) => structuredClone(item));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<SalesWarehouse[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.warehouses
      .filter((warehouse) => warehouse.tenantId === tenantId.value && wanted.has(warehouse.id))
      .map(({ tenantId: _tenant, ...warehouse }) => ({ ...warehouse }));
  }
}
