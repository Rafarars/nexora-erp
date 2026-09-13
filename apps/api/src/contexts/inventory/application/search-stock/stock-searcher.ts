import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';
import { StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';

export interface StockResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  averageCost: number;
  // Cantidad por costo promedio, redondeado a centimos: es lo que vale lo que hay.
  totalValue: number;
}

export class StockSearcher {
  constructor(
    private readonly stocks: StockRepository,
    private readonly catalog: InventoryCatalog,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string | null }): Promise<{ stocks: StockResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    // Filtrar por una bodega de otra empresa responde como en el resto del sistema: no existe.
    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new StockWarehouseNotFoundError(warehouseId.value);
    }

    const stocks = await this.stocks.searchStocks(tenantId, warehouseId);

    const [items, warehouses] = await Promise.all([
      this.catalog.findItems(tenantId, [...new Map(stocks.map((s) => [s.itemId.value, s.itemId])).values()]),
      this.catalog.findWarehouses(tenantId, [...new Map(stocks.map((s) => [s.warehouseId.value, s.warehouseId])).values()]),
    ]);

    return {
      stocks: stocks
        .map((stock) => {
          const row = stock.toPrimitives();
          const item = items.find((candidate) => candidate.id === row.itemId);
          const valueMicros = (stock.available().units * stock.currentAverageCost().micros) / 10_000n;

          return {
            item: {
              id: row.itemId,
              sku: item?.sku ?? '',
              name: item?.name ?? '',
              baseUnit: item?.units.find((unit) => unit.isBase)?.abbreviation ?? '',
            },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            quantity: row.quantity,
            averageCost: row.averageCost,
            totalValue: Math.round(Number(valueMicros) / 10_000) / 100,
          };
        })
        .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.item.name.localeCompare(b.item.name)),
    };
  }
}
