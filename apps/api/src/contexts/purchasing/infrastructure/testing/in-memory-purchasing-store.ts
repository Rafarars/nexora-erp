import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import {
  GoodsReceiptNotEditableError,
  GoodsReceiptNotFoundError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
  ReceivedGoodsAlreadyUsedError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrder, PurchaseOrderId, PurchaseOrderPrimitives } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { ReceiptPosting, ReceiptPostingResult } from '../../domain/receipt/posting/receipt-posting.js';
import { GoodsReceipt, GoodsReceiptId, GoodsReceiptPrimitives } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryPurchasingCatalog } from './in-memory-purchasing-catalog.js';

const key = (tenantId: string, itemId: string, warehouseId: string) => `${tenantId}|${itemId}|${warehouseId}`;

interface StockLine {
  receiptId: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  reversed: boolean;
}

// Ordenes, entradas y un inventario de juguete en un solo almacen, porque en la base
// comparten transaccion. Imita lo que garantiza PostgreSQL: las publicaciones van de una en
// una, una que falla no deja nada escrito y la existencia nunca queda negativa.
//
// El inventario de juguete solo cuenta unidades por articulo y bodega: el costo promedio lo
// prueba el propio inventario. `withdraw` simula que la mercancia salio por otro documento.
export class InMemoryPurchasingStore {
  private readonly orderRows = new Map<string, PurchaseOrderPrimitives>();
  private readonly receiptRows = new Map<string, GoodsReceiptPrimitives>();
  private readonly stockLines: StockLine[] = [];
  private readonly withdrawn = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();

  // El catalogo de la prueba hace de tabla de articulos: confirmar una orden lo lee como si lo
  // tuviera bloqueado.
  constructor(private readonly catalog: InMemoryPurchasingCatalog) {}

  stockOf(tenantId: string, itemId: string, warehouseId: string): number {
    const lines = this.stockLines.filter((line) => key(line.tenantId, line.itemId, line.warehouseId) === key(tenantId, itemId, warehouseId));
    const received = lines.reduce((sum, line) => sum + (line.reversed ? 0 : line.quantity), 0);

    return received - (this.withdrawn.get(key(tenantId, itemId, warehouseId)) ?? 0);
  }

  withdraw(tenantId: string, itemId: string, warehouseId: string, quantity: number): void {
    const k = key(tenantId, itemId, warehouseId);

    this.withdrawn.set(k, (this.withdrawn.get(k) ?? 0) + quantity);
  }

  // Borradores: no pisan una orden o una entrada que entretanto cambio de estado.
  private async saveDraft(document: PurchaseOrder | GoodsReceipt): Promise<void> {
    if (document instanceof PurchaseOrder) {
      const stored = this.orderRows.get(document.id.value);

      if (stored && stored.status !== 'draft') throw new PurchaseOrderNotEditableError(stored.id, stored.status);
      if (stored && stored.updatedAt.getTime() !== document.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

      this.orderRows.set(document.id.value, structuredClone(document.toPrimitives()));
      return;
    }

    const stored = this.receiptRows.get(document.id.value);

    if (stored && stored.status !== 'draft') throw new GoodsReceiptNotEditableError(stored.id, stored.status);
    if (stored && stored.updatedAt.getTime() !== document.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

    this.receiptRows.set(document.id.value, structuredClone(document.toPrimitives()));
  }

  get orders(): PurchaseOrderRepository {
    return {
      save: (order) => this.saveDraft(order),
      find: async (tenantId, id) => this.loadOrder(tenantId, id),
      searchByTenant: async (tenantId) =>
        [...this.orderRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => PurchaseOrder.fromPrimitives(structuredClone(row))),
    };
  }

  get receipts(): GoodsReceiptRepository {
    return {
      save: (receipt) => this.saveDraft(receipt),
      find: async (tenantId, id) => this.loadReceipt(tenantId, id),
      searchByTenant: async (tenantId, orderId) =>
        [...this.receiptRows.values()]
          .filter((row) => row.tenantId === tenantId.value && (!orderId || row.orderId === orderId.value))
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => GoodsReceipt.fromPrimitives(structuredClone(row))),
    };
  }

  private loadOrder(tenantId: TenantId, id: PurchaseOrderId): PurchaseOrder | null {
    const row = this.orderRows.get(id.value);

    return row && row.tenantId === tenantId.value ? PurchaseOrder.fromPrimitives(structuredClone(row)) : null;
  }

  private loadReceipt(tenantId: TenantId, id: GoodsReceiptId): GoodsReceipt | null {
    const row = this.receiptRows.get(id.value);

    return row && row.tenantId === tenantId.value ? GoodsReceipt.fromPrimitives(structuredClone(row)) : null;
  }

  get orderPosting(): PurchaseOrderPosting {
    return {
      post: (tenantId, orderId, work) =>
        this.serial(async () => {
          const order = this.loadOrder(tenantId, orderId);

          if (!order) throw new PurchaseOrderNotFoundError(orderId.value);

          work(order, {
            item: (itemId) => {
              const item = this.catalog.items.find((candidate) => candidate.tenantId === tenantId.value && candidate.id === itemId.value);

              return item
                ? {
                    isActive: item.isActive,
                    type: item.type,
                    factorOf: (unitId) => item.units.find((unit) => unit.unitId === unitId.value)?.conversionFactor ?? null,
                  }
                : null;
            },
          });
          this.orderRows.set(order.id.value, structuredClone(order.toPrimitives()));
        }),
    };
  }

  get receiptPosting(): ReceiptPosting {
    return {
      post: (tenantId, receiptId, work) =>
        this.serial(async () => {
          const receipt = this.loadReceipt(tenantId, receiptId);

          if (!receipt) throw new GoodsReceiptNotFoundError(receiptId.value);

          const order = this.loadOrder(tenantId, receipt.orderId) as PurchaseOrder;
          const result: ReceiptPostingResult = work(receipt, order);
          const newLines: StockLine[] = [];

          if (result.stock.kind === 'receive') {
            newLines.push(
              ...result.stock.entries.map((entry) => ({
                receiptId: receipt.id.value,
                tenantId: tenantId.value,
                itemId: entry.itemId.value,
                warehouseId: entry.warehouseId.value,
                quantity: entry.quantity.toNumber(),
                reversed: false,
              })),
            );
          }

          const reversing = result.stock.kind === 'reverse' ? this.stockLines.filter((line) => line.receiptId === receipt.id.value && !line.reversed) : [];

          // Como el inventario de verdad: no se revierte lo que ya salio.
          for (const line of reversing) {
            if (this.stockOf(line.tenantId, line.itemId, line.warehouseId) < line.quantity) {
              throw new ReceivedGoodsAlreadyUsedError(receipt.id.value);
            }
          }

          // Nada se escribe hasta que todo lo anterior paso: es la transaccion.
          reversing.forEach((line) => (line.reversed = true));
          this.stockLines.push(...newLines);
          this.receiptRows.set(receipt.id.value, structuredClone(result.receipt.toPrimitives()));
          this.orderRows.set(order.id.value, structuredClone(result.order.toPrimitives()));
        }),
    };
  }

  // En serie, como el bloqueo de filas de la base.
  private serial(run: () => Promise<void>): Promise<void> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
