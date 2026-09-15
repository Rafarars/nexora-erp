import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';

// Las pruebas del catalogo declaran que bodegas tienen existencia.
export class InMemoryStockUsage implements StockUsage {
  readonly warehousesWithStock = new Set<string>();

  async warehouseHasStock(_tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    return this.warehousesWithStock.has(warehouseId.value);
  }
}
