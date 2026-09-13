import { PurchaseWarehouse, PurchasableItem, PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// El catalogo tal como lo ve compras, sembrado a mano en cada prueba.
export class InMemoryPurchasingCatalog implements PurchasingCatalog {
  constructor(
    readonly items: (PurchasableItem & { tenantId: string })[] = [],
    readonly warehouses: (PurchaseWarehouse & { tenantId: string })[] = [],
  ) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<PurchasableItem[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.items
      .filter((item) => item.tenantId === tenantId.value && wanted.has(item.id))
      .map(({ tenantId: _tenant, ...item }) => structuredClone(item));
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<PurchaseWarehouse[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.warehouses
      .filter((warehouse) => warehouse.tenantId === tenantId.value && wanted.has(warehouse.id))
      .map(({ tenantId: _tenant, ...warehouse }) => ({ ...warehouse }));
  }
}
