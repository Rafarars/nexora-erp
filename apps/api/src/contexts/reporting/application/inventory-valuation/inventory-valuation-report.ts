import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReportWarehouseNotFoundError } from '../../domain/errors/reporting.errors.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { stockValueUnits, unitsToNumber } from '../../domain/shared/money.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface InventoryValuationResponse {
  warehouse: string | null;
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;

  rows: { warehouse: { id: string; name: string }; item: { id: string; sku: string; name: string }; baseUnit: string; quantity: number; averageCost: number; value: number }[];
  totalValue: number;
}

// Cuanto vale lo que hay en bodega al costo promedio, que ya esta en la moneda de la empresa: el
// inventario convierte el costo al recibir. Una bodega de otra empresa responde como si no existiera.
export class InventoryValuationReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string }): Promise<InventoryValuationResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.warehouseId && !(await this.readModel.warehouseExists(tenantId, request.warehouseId))) throw new ReportWarehouseNotFoundError(request.warehouseId);

    const [decimals, currency] = await Promise.all([this.rates.amountDecimals(request.tenantId), this.rates.companyCurrency(request.tenantId)]);
    const stock = await this.readModel.stock(tenantId, request.warehouseId);
    const rows = stock
      .map((row) => ({
        warehouse: { id: row.warehouseId, name: row.warehouseName },
        item: { id: row.itemId, sku: row.sku, name: row.name },
        baseUnit: row.baseUnit,
        quantity: row.quantity,
        averageCost: row.averageCost,
        units: stockValueUnits(row.quantity, row.averageCost, decimals),
      }))
      .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.item.sku.localeCompare(b.item.sku));

    return {
      warehouse: request.warehouseId ?? null,
      currency,
      rows: rows.map(({ units, ...row }) => ({ ...row, value: unitsToNumber(units) })),
      totalValue: unitsToNumber(rows.reduce((sum, row) => sum + row.units, 0n)),
    };
  }
}
