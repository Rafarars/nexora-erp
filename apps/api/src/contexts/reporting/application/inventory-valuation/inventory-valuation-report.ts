import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReportWarehouseNotFoundError } from '../../domain/errors/reporting.errors.js';
import { ReportPage, pageOf } from '../../domain/page/report-page.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { stockValueUnits, unitsToNumber } from '../../domain/shared/money.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';

export interface InventoryValuationResponse {
  warehouse: string | null;
  // Como se llama la bodega filtrada, para que el documento lo diga sin mirar las filas.
  warehouseName: string | null;
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;
  // Los decimales de la empresa: la pantalla y el PDF escriben el importe igual.
  decimals: number;

  page: ReportPage;

  rows: { warehouse: { id: string; name: string }; item: { id: string; sku: string; name: string }; baseUnit: string; quantity: number; averageCost: number; value: number }[];
  // Cubre TODAS las filas, no solo la pagina enviada.
  totalValue: number;
}

// Cuanto vale lo que hay en bodega al costo promedio, que ya esta en la moneda de la empresa: el
// inventario convierte el costo al recibir. Una bodega de otra empresa responde como si no existiera.
export class InventoryValuationReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string; limit?: number; offset?: number }): Promise<InventoryValuationResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Se valida el formato antes de consultar: un identificador malo es una peticion incorrecta,
    // no un fallo del servidor.
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId).value : undefined;

    // El nombre se pide aqui, no se toma de la primera fila: una bodega vacia no tiene filas y el
    // PDF acababa diciendo "Todas las bodegas" con el total en cero.
    const warehouseName = warehouseId ? await this.readModel.warehouseNamed(tenantId, warehouseId) : null;

    if (warehouseId && warehouseName === null) throw new ReportWarehouseNotFoundError(warehouseId);

    const [decimals, currency] = await Promise.all([this.rates.amountDecimals(request.tenantId), this.rates.companyCurrency(request.tenantId)]);
    const stock = await this.readModel.stock(tenantId, warehouseId);
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

    const shown = pageOf(rows, request.limit, request.offset);

    return {
      warehouse: warehouseId ?? null,
      warehouseName,
      currency,
      decimals,
      page: shown.page,
      rows: shown.rows.map(({ units, ...row }) => ({ ...row, value: unitsToNumber(units) })),
      totalValue: unitsToNumber(rows.reduce((sum, row) => sum + row.units, 0n)),
    };
  }
}
