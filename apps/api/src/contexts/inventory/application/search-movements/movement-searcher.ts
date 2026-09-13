import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { InventoryCatalog } from '../../domain/catalog/inventory-catalog.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';
import { StockItemNotFoundError, StockWarehouseNotFoundError } from '../../domain/errors/inventory.errors.js';

export interface MovementResponse {
  id: string;
  warehouse: { id: string; name: string };
  sequence: number;
  direction: 'in' | 'out';
  quantity: number;
  unitCost: number;
  balanceQuantity: number;
  balanceAverageCost: number;
  origin: { type: 'adjustment'; id: string; code: string };
  isReversal: boolean;
  occurredAt: string;
}

// El kardex de un articulo, por bodega y en orden: cada fila dice que paso y como quedo.
export class MovementSearcher {
  constructor(
    private readonly stocks: StockRepository,
    private readonly adjustments: AdjustmentRepository,
    private readonly catalog: InventoryCatalog,
  ) {}

  async run(request: { tenantId: string; itemId: string; warehouseId?: string | null }): Promise<{ movements: MovementResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouseId = request.warehouseId ? WarehouseRef.of(request.warehouseId) : undefined;
    const itemId = ItemRef.of(request.itemId);

    // Una lista vacia para el articulo de otra empresa confirmaria menos que un 404, pero
    // trataria distinto a lo ajeno y a lo inexistente. Se responde igual que en el catalogo.
    if ((await this.catalog.findItems(tenantId, [itemId])).length === 0) {
      throw new StockItemNotFoundError(itemId.value);
    }

    if (warehouseId && (await this.catalog.findWarehouses(tenantId, [warehouseId])).length === 0) {
      throw new StockWarehouseNotFoundError(warehouseId.value);
    }

    const movements = await this.stocks.searchMovements(tenantId, itemId, warehouseId);

    const [warehouses, adjustments] = await Promise.all([
      this.catalog.findWarehouses(tenantId, [...new Map(movements.map((m) => [m.warehouseId.value, m.warehouseId])).values()]),
      this.adjustments.searchByTenant(tenantId),
    ]);

    return {
      movements: movements.map((movement) => {
        const row = movement.toPrimitives();

        return {
          id: row.id,
          warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
          sequence: row.sequence,
          direction: row.direction,
          quantity: row.quantity,
          unitCost: row.unitCost,
          balanceQuantity: row.balanceQuantity,
          balanceAverageCost: row.balanceAverageCost,
          origin: {
            type: row.originType,
            id: row.originId,
            code: adjustments.find((adjustment) => adjustment.id.value === row.originId)?.code ?? '',
          },
          isReversal: row.reversalOfId !== null,
          occurredAt: row.occurredAt.toISOString(),
        };
      }),
    };
  }
}
