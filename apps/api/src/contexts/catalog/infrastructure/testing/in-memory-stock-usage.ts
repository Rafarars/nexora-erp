import { ItemId } from '../../domain/item/item-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';

// Las pruebas del catalogo declaran que articulos y bodegas tienen existencia o historia.
export class InMemoryStockUsage implements StockUsage {
  readonly itemsWithStock = new Set<string>();
  readonly itemsWithMovements = new Set<string>();
  readonly warehousesWithStock = new Set<string>();

  async itemHasStock(_tenantId: TenantId, itemId: ItemId): Promise<boolean> {
    return this.itemsWithStock.has(itemId.value);
  }

  async itemHasMovements(_tenantId: TenantId, itemId: ItemId): Promise<boolean> {
    return this.itemsWithMovements.has(itemId.value);
  }

  async warehouseHasStock(_tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    return this.warehousesWithStock.has(warehouseId.value);
  }
}
