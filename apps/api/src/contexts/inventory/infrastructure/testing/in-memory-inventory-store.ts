import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { Adjustment, AdjustmentId, AdjustmentPrimitives } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentCriteria, AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentPosting, Ledger, Posting } from '../../domain/adjustment/posting/adjustment-posting.js';
import {
  AdjustmentNotEditableError,
  AdjustmentNotFoundError,
  InsufficientStockError,
} from '../../domain/errors/inventory.errors.js';
import { InventoryMovement, InventoryMovementPrimitives } from '../../domain/movement/inventory-movement.entity.js';
import { Quantity } from '../../domain/quantity/quantity.vo.js';
import { UnitCost } from '../../domain/quantity/unit-cost.vo.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { weightedAverageCost } from '../../domain/stock/average-cost.js';
import { ItemStock, ItemStockPrimitives } from '../../domain/stock/item-stock.entity.js';
import { StockRepository } from '../../domain/stock/stock.repository.js';
import { InMemoryInventoryCatalog } from './in-memory-inventory-catalog.js';

const stockKey = (tenantId: string, itemId: string, warehouseId: string) => `${tenantId}|${itemId}|${warehouseId}`;

// Ajustes, existencias y kardex en un solo almacen, porque en la base comparten
// transaccion. Imita lo que PostgreSQL garantiza: las publicaciones se ejecutan de una en
// una, una que falla no deja nada escrito, la existencia nunca queda negativa y un
// movimiento no se revierte dos veces.
export class InMemoryInventoryStore implements AdjustmentRepository, StockRepository, AdjustmentPosting {
  private adjustments = new Map<string, AdjustmentPrimitives>();
  private stocks = new Map<string, ItemStockPrimitives>();
  private movements: InventoryMovementPrimitives[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  // El catalogo de la prueba hace de tabla de articulos: la publicacion lo lee como si lo
  // tuviera bloqueado.
  constructor(
    private readonly catalog: InMemoryInventoryCatalog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Como la base: un borrador guardado no puede pisar un ajuste que entretanto se
  // confirmo o se anulo. Los cambios de estado los escribe `post`.
  async save(adjustment: Adjustment): Promise<void> {
    const row = adjustment.toPrimitives();
    const stored = this.adjustments.get(row.id);

    if (stored && stored.status !== 'draft') {
      throw new AdjustmentNotEditableError(row.id, stored.status);
    }

    if (stored && stored.updatedAt.getTime() !== adjustment.version()?.getTime()) {
      throw new ConcurrentModificationError(row.id);
    }

    this.write(adjustment);
  }

  private write(adjustment: Adjustment): void {
    const row = adjustment.toPrimitives();

    this.adjustments.set(row.id, structuredClone(row));
  }

  async find(tenantId: TenantId, id: AdjustmentId): Promise<Adjustment | null> {
    const row = this.adjustments.get(id.value);

    return row && row.tenantId === tenantId.value ? Adjustment.fromPrimitives(structuredClone(row)) : null;
  }

  // Filtra y pagina igual que la base: el doble que filtra de menos da por buenas consultas
  // que PostgreSQL rechaza, y el contrato deja de servir.
  async search(tenantId: TenantId, criteria: AdjustmentCriteria): Promise<{ adjustments: Adjustment[]; total: number }> {
    const text = criteria.text?.toLowerCase() ?? null;
    const matching = [...this.adjustments.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .filter((row) => !criteria.warehouseId || row.warehouseId === criteria.warehouseId)
      .filter((row) => !criteria.status || row.status === criteria.status)
      .filter((row) => !criteria.type || row.type === criteria.type)
      .filter((row) => !criteria.from || row.adjustmentDate >= criteria.from)
      .filter((row) => !criteria.to || row.adjustmentDate <= criteria.to)
      .filter((row) => !text || row.code.toLowerCase().includes(text) || (row.notes?.toLowerCase().includes(text) ?? false))
      .sort((a, b) => b.code.localeCompare(a.code));

    return {
      adjustments: matching
        .slice(criteria.offset, criteria.offset + criteria.limit)
        .map((row) => Adjustment.fromPrimitives(structuredClone(row))),
      total: matching.length,
    };
  }

  async searchStocks(tenantId: TenantId, warehouseId?: WarehouseRef): Promise<ItemStock[]> {
    return [...this.stocks.values()]
      .filter((row) => row.tenantId === tenantId.value && (!warehouseId || row.warehouseId === warehouseId.value))
      .map((row) => ItemStock.fromPrimitives(row));
  }

  async searchMovements(tenantId: TenantId, itemId: ItemRef, warehouseId?: WarehouseRef): Promise<InventoryMovement[]> {
    return this.movements
      .filter(
        (row) =>
          row.tenantId === tenantId.value &&
          row.itemId === itemId.value &&
          (!warehouseId || row.warehouseId === warehouseId.value),
      )
      .sort((a, b) => a.warehouseId.localeCompare(b.warehouseId) || a.sequence - b.sequence)
      .map((row) => InventoryMovement.fromPrimitives(row));
  }

  // En serie, como el bloqueo de filas de la base.
  post(tenantId: TenantId, adjustmentId: AdjustmentId, work: (adjustment: Adjustment, ledger: Ledger) => Posting): Promise<void> {
    const run = this.queue.then(() => this.postNow(tenantId, adjustmentId, work));

    this.queue = run.catch(() => undefined);

    return run;
  }

  private async postNow(
    tenantId: TenantId,
    adjustmentId: AdjustmentId,
    work: (adjustment: Adjustment, ledger: Ledger) => Posting,
  ): Promise<void> {
    const adjustment = await this.find(tenantId, adjustmentId);

    if (!adjustment) throw new AdjustmentNotFoundError(adjustmentId.value);

    const loaded = new Map<string, ItemStock>();
    const ledger: Ledger = {
      item: (itemId) => {
        const item = this.catalog.itemOf(tenantId.value, itemId.value);

        if (!item) throw new Error(`Item <${itemId.value}> is not in the catalog of the test.`);

        return {
          isActive: item.isActive,
          type: item.type,
          factorOf: (unitId) => item.units.find((unit) => unit.unitId === unitId.value)?.conversionFactor ?? null,
        };
      },
      stock: (itemId, warehouseId) => {
        const key = stockKey(tenantId.value, itemId.value, warehouseId.value);
        const row = this.stocks.get(key);
        const stock = loaded.get(key) ?? (row ? ItemStock.fromPrimitives(row) : ItemStock.empty(tenantId, itemId, warehouseId, this.now()));

        loaded.set(key, stock);

        return stock;
      },
      // Todas las bodegas de ESTA empresa: el promedio de una empresa no vale para otra.
      averageCostOf: (itemId) =>
        weightedAverageCost(
          [...this.stocks.values()]
            .filter((row) => row.tenantId === tenantId.value && row.itemId === itemId.value)
            .map((row) => ({ quantity: Quantity.of(row.quantity), averageCost: UnitCost.of(row.averageCost) })),
        ),
      movementsOf: (id) =>
        this.movements
          .filter((row) => row.tenantId === tenantId.value && row.originId === id)
          .map((row) => InventoryMovement.fromPrimitives(row)),
    };

    const posting = work(adjustment, ledger);

    for (const stock of posting.stocks) {
      if (stock.available().units < 0n) {
        throw new InsufficientStockError(stock.itemId.value, stock.warehouseId.value, stock.available().toNumber(), 0);
      }
    }

    const reversed = new Set(this.movements.map((row) => row.reversalOfId).filter(Boolean));

    for (const movement of posting.movements) {
      if (movement.reversalOfId && reversed.has(movement.reversalOfId.value)) {
        throw new Error(`Movement <${movement.reversalOfId.value}> is already reversed.`);
      }
    }

    // Nada se escribe hasta que todo lo anterior paso: es la transaccion.
    this.write(posting.adjustment);

    for (const stock of posting.stocks) {
      const row = stock.toPrimitives();
      this.stocks.set(stockKey(row.tenantId, row.itemId, row.warehouseId), row);
    }

    this.movements.push(...posting.movements.map((movement) => movement.toPrimitives()));
  }
}
