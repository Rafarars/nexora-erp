import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { PurchaseWarehouseNotFoundError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { Quantity } from '../../domain/shared/quantity.vo.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface IncomingStockResponse {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  // En unidad base: lo pedido en ordenes confirmadas que todavia no llego.
  quantity: number;
  // `late` lo decide el hoy de la empresa, en su zona horaria: la pantalla no la conoce.
  orders: { id: string; code: string; expectedDate: string | null; late: boolean; pendingQuantity: number }[];
}

export interface IncomingSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  incoming: IncomingStockResponse[];
}

const DEFAULT_PAGE = 20;

// La mercancia en camino: lo que anuncian las ordenes confirmadas o recibidas en parte, por
// articulo y bodega. Un borrador todavia no promete nada y una anulada ya no.
export class IncomingStockSearcher {
  constructor(
    private readonly orders: PurchaseOrderRepository,
    private readonly catalog: PurchasingCatalog,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: {
    tenantId: string;
    warehouseId?: string | null;
    q?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<IncomingSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new PurchaseWarehouseNotFoundError(warehouseId.value);
    }

    // Solo lo que sigue esperando mercancia: antes se traia la empresa entera para descartarla.
    const [open, today] = await Promise.all([
      this.orders.searchOpen(tenantId, warehouseId?.value ?? null),
      this.calendar.today(request.tenantId),
    ]);
    const groups = new Map<string, { itemId: string; warehouseId: string; quantity: Quantity; orders: IncomingStockResponse['orders'] }>();

    for (const order of [...open].sort((a, b) => a.code.localeCompare(b.code))) {
      for (const line of order.lines()) {
        // Un servicio no entra a una bodega, asi que nunca deja de estar pendiente: si se contara,
        // la fila no se iria nunca. Es el mismo filtro que usa la existencia esperada del inventario.
        if (!line.movesStock) continue;

        const pending = line.pendingBase();

        if (pending.isZero()) continue;

        const key = `${line.itemId.value}|${order.warehouseId().value}`;
        const group = groups.get(key) ?? { itemId: line.itemId.value, warehouseId: order.warehouseId().value, quantity: Quantity.zero(), orders: [] };

        group.quantity = group.quantity.plus(pending);
        const expectedDate = order.expectedDate()?.value ?? null;

        group.orders.push({
          id: order.id.value,
          code: order.code,
          expectedDate,
          late: expectedDate !== null && expectedDate < today,
          pendingQuantity: pending.toNumber(),
        });
        groups.set(key, group);
      }
    }

    const values = [...groups.values()];
    const [items, warehouses] = await Promise.all([
      this.catalog.findItems(tenantId, [...new Set(values.map((g) => g.itemId))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(values.map((g) => g.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const text = request.q?.trim().toLowerCase() ?? null;
    const all = values
      .map((group) => {
          const item = items.find((candidate) => candidate.id === group.itemId);

          return {
            item: {
              id: group.itemId,
              sku: item?.sku ?? '',
              name: item?.name ?? '',
              baseUnit: item?.units.find((unit) => unit.isBase)?.abbreviation ?? '',
            },
            warehouse: { id: group.warehouseId, name: warehouses.find((w) => w.id === group.warehouseId)?.name ?? '' },
            quantity: group.quantity.toNumber(),
            orders: group.orders,
          };
      })
      .filter((row) => text === null || row.item.sku.toLowerCase().includes(text) || row.item.name.toLowerCase().includes(text))
      // El desempate por SKU evita que dos articulos homonimos se turnen entre paginas.
      .sort(
        (a, b) =>
          a.warehouse.name.localeCompare(b.warehouse.name) ||
          a.item.name.localeCompare(b.item.name) ||
          a.item.sku.localeCompare(b.item.sku),
      );

    return {
      total: all.length,
      limit,
      offset,
      hasMore: offset + Math.min(limit, Math.max(0, all.length - offset)) < all.length,
      incoming: all.slice(offset, offset + limit),
    };
  }
}
