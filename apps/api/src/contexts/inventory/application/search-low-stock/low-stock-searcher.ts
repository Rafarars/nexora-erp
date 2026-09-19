import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ExpectedStock } from '../../domain/stock/expected-stock.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';

export interface LowStockResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  // La existencia fisica, y las tres cifras que la corrigen: lo que ya esta vendido, lo que ya
  // esta pedido al proveedor, y el resultado con el que se decide si hay que reponer.
  quantity: number;
  reserved: number;
  incoming: number;
  projected: number;
  minQuantity: number;
  maxQuantity: number | null;
  // Lo que falta para llegar al minimo y lo que conviene pedir.
  missing: number;
  suggested: number;
}

// Lo que hay que reponer: por cada regla de un articulo en una bodega, si la existencia
// proyectada bajo del minimo. Proyectada = lo que hay, menos lo que los pedidos confirmados ya
// reservaron, mas lo que las ordenes de compra traen en camino; comparar solo contra lo fisico
// manda a comprar de nuevo lo que ya viene. Es lo que hacen Odoo y ERPNext. Sin regla no se
// vigila, que tambien es lo que hacen ellos con sus reglas por almacen.
export class LowStockSearcher {
  constructor(
    private readonly items: ItemRepository,
    private readonly stocks: StockRepository,
    private readonly catalog: InventoryCatalog,
    private readonly expected: ExpectedStock,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string | null }): Promise<{ rows: LowStockResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new StockWarehouseNotFoundError(warehouseId.value);
    }

    const [items, stocks, expected] = await Promise.all([
      this.items.withReorderRules(tenantId),
      this.stocks.searchStocks(tenantId, warehouseId),
      this.expected.pending(tenantId, warehouseId),
    ]);
    const quantities = new Map(stocks.map((stock) => [`${stock.itemId.value}:${stock.warehouseId.value}`, stock.toPrimitives().quantity]));
    const pending = new Map(expected.map((row) => [`${row.itemId}:${row.warehouseId}`, row]));
    const warehouses = await this.catalog.findWarehouses(
      tenantId,
      [...new Map(items.flatMap((item) => item.reorderRules().warehouseIds()).map((id) => [id.value, id])).values()],
    );
    const catalogItems = await this.catalog.findItems(tenantId, items.map((item) => item.id));

    // Una bodega cerrada ya no se repone, y un servicio no tiene existencia que vigilar aunque
    // alguien le haya dejado una regla.
    const open = new Set(warehouses.filter((warehouse) => warehouse.isActive).map((warehouse) => warehouse.id));

    const rows = items
      .filter((item) => item.isActive())
      .flatMap((item) => {
        const row = item.toPrimitives();
        const catalogItem = catalogItems.find((candidate) => candidate.id === row.id);

        if (row.type === 'service') return [];

        return row.reorderRules
          .filter((rule) => open.has(rule.warehouseId))
          .filter((rule) => !warehouseId || rule.warehouseId === warehouseId.value)
          .map((rule) => {
            const key = `${row.id}:${rule.warehouseId}`;
            const { reserved, incoming } = pending.get(key) ?? { reserved: 0, incoming: 0 };
            const quantity = quantities.get(key) ?? 0;

            return { row, rule, quantity, reserved, incoming, projected: round(quantity - reserved + incoming), catalogItem };
          })
          .filter(({ rule, projected }) => projected < rule.minQuantity)
          .map(({ rule, quantity, reserved, incoming, projected }) => ({
            item: {
              id: row.id,
              sku: row.sku,
              name: row.name,
              baseUnit: catalogItem?.units.find((unit) => unit.isBase)?.abbreviation ?? '',
            },
            warehouse: { id: rule.warehouseId, name: warehouses.find((warehouse) => warehouse.id === rule.warehouseId)?.name ?? '' },
            quantity,
            reserved,
            incoming,
            projected,
            minQuantity: rule.minQuantity,
            maxQuantity: rule.maxQuantity,
            missing: round(rule.minQuantity - projected),
            // Lo que se sugiere pedir: la cantidad de la regla, o lo que falta para el maximo.
            suggested: rule.reorderQuantity > 0 ? rule.reorderQuantity : round((rule.maxQuantity ?? rule.minQuantity) - projected),
          }));
      })
      .sort((left, right) => left.warehouse.name.localeCompare(right.warehouse.name) || left.item.name.localeCompare(right.item.name));

    return { rows };
  }
}

// Cuatro decimales, los de las cantidades.
const round = (value: number) => Math.round(value * 10_000) / 10_000;
