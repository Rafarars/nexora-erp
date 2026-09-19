import { InventoryCatalog, StockWarehouse, StockableItem } from '../../domain/catalog/inventory-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Los articulos y las bodegas tal como los ven los ajustes, sembrados a mano en cada prueba.
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

  // Lo que en la base haria el maestro de articulos: dejar de ofrecer uno.
  deactivate(itemId: string): void {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (item) item.isActive = false;
  }

  // Lo mismo sin esperar: el libro de una publicacion lo lee dentro de un trabajo sincrono.
  itemOf(tenantId: string, itemId: string): StockableItem | null {
    const item = this.items.find((candidate) => candidate.tenantId === tenantId && candidate.id === itemId);

    return item ?? null;
  }

  // Como itemOf: el orden del listado de existencias es por nombre de bodega.
  warehouseOf(tenantId: string, warehouseId: string): StockWarehouse | null {
    return this.warehouses.find((candidate) => candidate.tenantId === tenantId && candidate.id === warehouseId) ?? null;
  }

  async findWarehouses(tenantId: TenantId, ids: WarehouseRef[]): Promise<StockWarehouse[]> {
    const wanted = new Set(ids.map((id) => id.value));

    return this.warehouses
      .filter((warehouse) => warehouse.tenantId === tenantId.value && wanted.has(warehouse.id))
      .map(({ tenantId: _tenant, ...warehouse }) => warehouse);
  }
}
