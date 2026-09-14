import { ReportWarehouseNotFoundError } from '../../domain/errors/reporting.errors.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { centsToNumber } from '../../domain/shared/money.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { stockValueCents } from '../search-dashboard/dashboard-searcher.js';

export interface InventoryValuationResponse {
  warehouse: string | null;
  rows: { warehouse: { id: string; name: string }; item: { id: string; sku: string; name: string }; baseUnit: string; quantity: number; averageCost: number; value: number }[];
  totalValue: number;
}

// Cuanto vale lo que hay en bodega al costo promedio. Una bodega de otra empresa responde como si no
// existiera.
export class InventoryValuationReport {
  constructor(private readonly readModel: ReportingReadModel) {}

  async run(request: { tenantId: string; warehouseId?: string }): Promise<InventoryValuationResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.warehouseId && !(await this.readModel.warehouseExists(tenantId, request.warehouseId))) throw new ReportWarehouseNotFoundError(request.warehouseId);

    const stock = await this.readModel.stock(tenantId, request.warehouseId);
    const rows = stock
      .map((row) => ({
        warehouse: { id: row.warehouseId, name: row.warehouseName },
        item: { id: row.itemId, sku: row.sku, name: row.name },
        baseUnit: row.baseUnit,
        quantity: row.quantity,
        averageCost: row.averageCost,
        cents: stockValueCents(row.quantity, row.averageCost),
      }))
      .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.item.sku.localeCompare(b.item.sku));

    return {
      warehouse: request.warehouseId ?? null,
      rows: rows.map(({ cents, ...row }) => ({ ...row, value: centsToNumber(cents) })),
      totalValue: centsToNumber(rows.reduce((sum, row) => sum + row.cents, 0n)),
    };
  }
}
