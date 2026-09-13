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
  orders: { id: string; code: string; expectedDate: string | null; pendingQuantity: number }[];
}

// La mercancia en camino: lo que anuncian las ordenes confirmadas o recibidas en parte, por
// articulo y bodega. Un borrador todavia no promete nada y una anulada ya no.
export class IncomingStockSearcher {
  constructor(
    private readonly orders: PurchaseOrderRepository,
    private readonly catalog: PurchasingCatalog,
  ) {}

  async run(request: { tenantId: string; warehouseId?: string | null }): Promise<{ incoming: IncomingStockResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new PurchaseWarehouseNotFoundError(warehouseId.value);
    }

    const open = (await this.orders.searchByTenant(tenantId)).filter(
      (order) => order.isReceivable() && (!warehouseId || order.warehouseId().equals(warehouseId)),
    );
    const groups = new Map<string, { itemId: string; warehouseId: string; quantity: Quantity; orders: IncomingStockResponse['orders'] }>();

    for (const order of [...open].sort((a, b) => a.code.localeCompare(b.code))) {
      for (const line of order.lines()) {
        const pending = line.pendingBase();

        if (pending.isZero()) continue;

        const key = `${line.itemId.value}|${order.warehouseId().value}`;
        const group = groups.get(key) ?? { itemId: line.itemId.value, warehouseId: order.warehouseId().value, quantity: Quantity.zero(), orders: [] };

        group.quantity = group.quantity.plus(pending);
        group.orders.push({ id: order.id.value, code: order.code, expectedDate: order.expectedDate()?.value ?? null, pendingQuantity: pending.toNumber() });
        groups.set(key, group);
      }
    }

    const values = [...groups.values()];
    const [items, warehouses] = await Promise.all([
      this.catalog.findItems(tenantId, [...new Set(values.map((g) => g.itemId))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(values.map((g) => g.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    return {
      incoming: values
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
        .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.item.name.localeCompare(b.item.name)),
    };
  }
}
