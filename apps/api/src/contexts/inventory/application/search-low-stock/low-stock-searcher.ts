import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';

export interface LowStockResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  // Lo que falta para llegar al minimo y lo que conviene pedir.
  missing: number;
  suggested: number;
}

// Lo que hay que reponer: por cada regla de un articulo en una bodega, si la existencia bajo del
// minimo. Sin regla no se vigila, que es lo que hacen Odoo y ERPNext con sus reglas por almacen.
export class LowStockSearcher {
  constructor(
    private readonly items: ItemRepository,
    private readonly stocks: StockRepository,
    private readonly catalog: InventoryCatalog,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string | null }): Promise<{ rows: LowStockResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new StockWarehouseNotFoundError(warehouseId.value);
    }

    const [items, stocks] = await Promise.all([this.items.withReorderRules(tenantId), this.stocks.searchStocks(tenantId, warehouseId)]);
    const quantities = new Map(stocks.map((stock) => [`${stock.itemId.value}:${stock.warehouseId.value}`, stock.toPrimitives().quantity]));
    const warehouses = await this.catalog.findWarehouses(
      tenantId,
      [...new Map(items.flatMap((item) => item.reorderRules().warehouseIds()).map((id) => [id.value, id])).values()],
    );
    const catalogItems = await this.catalog.findItems(tenantId, items.map((item) => item.id));

    const rows = items
      .filter((item) => item.isActive())
      .flatMap((item) => {
        const row = item.toPrimitives();
        const catalogItem = catalogItems.find((candidate) => candidate.id === row.id);

        return row.reorderRules
          .filter((rule) => !warehouseId || rule.warehouseId === warehouseId.value)
          .map((rule) => ({ row, rule, quantity: quantities.get(`${row.id}:${rule.warehouseId}`) ?? 0, catalogItem }))
          .filter(({ rule, quantity }) => quantity < rule.minQuantity)
          .map(({ rule, quantity }) => ({
            item: {
              id: row.id,
              sku: row.sku,
              name: row.name,
              baseUnit: catalogItem?.units.find((unit) => unit.isBase)?.abbreviation ?? '',
            },
            warehouse: { id: rule.warehouseId, name: warehouses.find((warehouse) => warehouse.id === rule.warehouseId)?.name ?? '' },
            quantity,
            minQuantity: rule.minQuantity,
            maxQuantity: rule.maxQuantity,
            missing: round(rule.minQuantity - quantity),
            // Lo que se sugiere pedir: la cantidad de la regla, o lo que falta para el maximo.
            suggested: rule.reorderQuantity > 0 ? rule.reorderQuantity : round((rule.maxQuantity ?? rule.minQuantity) - quantity),
          }));
      })
      .sort((left, right) => left.warehouse.name.localeCompare(right.warehouse.name) || left.item.name.localeCompare(right.item.name));

    return { rows };
  }
}

// Cuatro decimales, los de las cantidades.
const round = (value: number) => Math.round(value * 10_000) / 10_000;
