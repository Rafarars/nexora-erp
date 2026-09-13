import { InventoryCatalog, StockWarehouse, StockableItem } from '../../domain/catalog/inventory-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// El catalogo tal como lo ve el inventario, sembrado a mano en cada prueba.
export class InMemoryInventoryCatalog implements InventoryCatalog {
  constructor(
    private readonly items: (StockableItem & { tenantId: string })[] = [],
    private readonly warehouses: (StockWarehouse & { tenantId: string })[] = [],
  ) {}

  async findItems(tenantId: TenantId, ids: ItemRef[]): Promise<StockableItem[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.items
      .filter((item) => item.tenantId === tenantId.value && wanted.has(item.id))
      .map(({ tenantId: _tenant, ...item }) => item);
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<StockWarehouse[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.warehouses
      .filter((warehouse) => warehouse.tenantId === tenantId.value && wanted.has(warehouse.id))
      .map(({ tenantId: _tenant, ...warehouse }) => warehouse);
  }
}
