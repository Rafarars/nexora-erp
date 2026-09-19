import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';

// Las pruebas del catalogo declaran que bodegas tienen existencia y cuales espera un documento.
// La clave lleva la empresa, como la consulta de la base: sin eso el doble dejaria pasar una
// bodega ajena y el contrato mentiria sobre el aislamiento.
export class InMemoryStockUsage implements StockUsage {
  readonly withStock = new Set<string>();
  readonly withOpenDocuments = new Set<string>();

  addStock(tenantId: string, warehouseId: string): void {
    this.withStock.add(`${tenantId}:${warehouseId}`);
  }

  addOpenDocument(tenantId: string, warehouseId: string): void {
    this.withOpenDocuments.add(`${tenantId}:${warehouseId}`);
  }

  async warehouseHasStock(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    return this.withStock.has(`${tenantId.value}:${warehouseId.value}`);
  }

  async warehouseHasOpenDocuments(tenantId: TenantId, warehouseId: WarehouseId): Promise<boolean> {
    return this.withOpenDocuments.has(`${tenantId.value}:${warehouseId.value}`);
  }
}
