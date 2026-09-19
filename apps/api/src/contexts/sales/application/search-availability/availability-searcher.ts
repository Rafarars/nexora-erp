import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { SalesWarehouseNotFoundError } from '../../domain/errors/sales.errors.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { Quantity } from '../../domain/shared/quantity.vo.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SalesStock } from '../../domain/stock/sales-stock.js';

export interface AvailabilityResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  // En unidad base. Disponible = existencia − reservado, nunca negativo en pantalla.
  onHand: number;
  reserved: number;
  available: number;
}

export interface AvailabilitySearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  availability: AvailabilityResponse[];
}

const DEFAULT_PAGE = 20;

// Cuanto se puede vender de cada articulo en cada bodega: lo que hay menos lo que ya reservaron
// los pedidos confirmados. Es una foto para mirar; la reserva de verdad se decide al confirmar.
export class AvailabilitySearcher {
  constructor(
    private readonly stock: SalesStock,
    private readonly orders: SalesOrderRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    warehouseId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<AvailabilitySearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new SalesWarehouseNotFoundError(warehouseId.value);
    }

    const rows = new Map<string, { itemId: string; warehouseId: string; onHand: Quantity; reserved: Quantity }>();
    const row = (itemId: string, warehouse: string) => {
      const k = `${itemId}|${warehouse}`;
      const current = rows.get(k) ?? { itemId, warehouseId: warehouse, onHand: Quantity.zero(), reserved: Quantity.zero() };

      rows.set(k, current);

      return current;
    };

    for (const stock of await this.stock.onHand(tenantId, warehouseId)) {
      row(stock.itemId, stock.warehouseId).onHand = Quantity.of(Math.max(0, stock.quantity));
    }

    for (const order of await this.orders.searchByTenant(tenantId)) {
      if (!order.isDispatchable() || (warehouseId && !order.warehouseId().equals(warehouseId))) continue;

      for (const [itemId, reserved] of order.reservedByItem()) {
        const current = row(itemId, order.warehouseId().value);
        current.reserved = current.reserved.plus(reserved);
      }
    }

    const values = [...rows.values()].filter((r) => !r.onHand.isZero() || !r.reserved.isZero());
    const [items, warehouses] = await Promise.all([
      this.catalog.findItems(tenantId, [...new Set(values.map((r) => r.itemId))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(values.map((r) => r.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const text = request.q?.trim().toLowerCase() ?? null;
    // La pagina se corta sobre los grupos ya calculados: la fila es articulo por bodega, no una
    // fila de ninguna tabla.
    const all = values
      .map((r) => {
        const item = items.find((candidate) => candidate.id === r.itemId);
        const available = r.reserved.isGreaterThan(r.onHand) ? Quantity.zero() : r.onHand.minus(r.reserved);

        return {
          item: { id: r.itemId, sku: item?.sku ?? '', name: item?.name ?? '', baseUnit: item?.units.find((u) => u.isBase)?.abbreviation ?? '' },
          warehouse: { id: r.warehouseId, name: warehouses.find((w) => w.id === r.warehouseId)?.name ?? '' },
          onHand: r.onHand.toNumber(),
          reserved: r.reserved.toNumber(),
          available: available.toNumber(),
        };
      })
      .filter((r) => r.item.sku !== '' && r.warehouse.name !== '')
      .filter((r) => text === null || r.item.sku.toLowerCase().includes(text) || r.item.name.toLowerCase().includes(text))
      // El desempate por SKU evita que dos articulos homonimos se turnen entre paginas.
      .sort(
        (a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.item.name.localeCompare(b.item.name) || a.item.sku.localeCompare(b.item.sku),
      );

    return {
      total: all.length,
      limit,
      offset,
      hasMore: offset + Math.min(limit, Math.max(0, all.length - offset)) < all.length,
      availability: all.slice(offset, offset + limit),
    };
  }
}
