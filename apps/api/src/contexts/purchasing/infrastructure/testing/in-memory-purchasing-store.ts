import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import {
  GoodsReceiptHasConfirmedInvoicesError,
  GoodsReceiptNotEditableError,
  GoodsReceiptNotFoundError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotEditableError,
  PurchaseReturnNotFoundError,
  PurchaseReturnSupplierMismatchError,
  QuantityExceedsReceiptReturnQuotaError,
  ReceiptLineNotFoundError,
  ReceiptNotReturnableError,
  ReceivedGoodsAlreadyUsedError,
  ReturnBeforeReceiptError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrder, PurchaseOrderId, PurchaseOrderPrimitives } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { ReceiptPosting, ReceiptPostingResult } from '../../domain/receipt/posting/receipt-posting.js';
import { GoodsReceipt, GoodsReceiptId, GoodsReceiptPrimitives } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { PurchaseReturnPosting } from '../../domain/return/posting/purchase-return-posting.js';
import { PurchaseReturn, PurchaseReturnId, PurchaseReturnPrimitives } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryPurchasingCatalog } from './in-memory-purchasing-catalog.js';

const key = (tenantId: string, itemId: string, warehouseId: string) => `${tenantId}|${itemId}|${warehouseId}`;

interface StockLine {
  receiptId?: string;
  returnId?: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  reversed: boolean;
}

// Ordenes, entradas y un inventario de juguete en un solo almacen, porque en la base
// comparten transaccion. Imita lo que garantiza PostgreSQL: las publicaciones van de una en
// una, una que falla no deja nada escrito y la existencia nunca queda negativa.
export class InMemoryPurchasingStore {
  private readonly orderRows = new Map<string, PurchaseOrderPrimitives>();
  private readonly receiptRows = new Map<string, GoodsReceiptPrimitives>();
  private readonly returnRows = new Map<string, PurchaseReturnPrimitives>();
  private readonly stockLines: StockLine[] = [];
  private readonly stocks = new Map<string, { quantity: number; averageCost: number }>();
  private readonly withdrawn = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();
  private confirmedInvoicesChecker?: (receiptLineIds: string[]) => Promise<boolean> | boolean;

  setConfirmedInvoicesChecker(fn: (receiptLineIds: string[]) => Promise<boolean> | boolean): void {
    this.confirmedInvoicesChecker = fn;
  }

  // El catalogo de la prueba hace de tabla de articulos: confirmar una orden lo lee como si lo
  // tuviera bloqueado.
  constructor(private readonly catalog: InMemoryPurchasingCatalog) {}

  stockOf(tenantId: string, itemId: string, warehouseId: string): number {
    const lines = this.stockLines.filter((line) => key(line.tenantId, line.itemId, line.warehouseId) === key(tenantId, itemId, warehouseId));
    const received = lines.reduce((sum, line) => sum + (line.reversed ? 0 : line.quantity), 0);

    return received - (this.withdrawn.get(key(tenantId, itemId, warehouseId)) ?? 0);
  }

  averageCostOf(tenantId: string, itemId: string, warehouseId: string): number {
    return this.stocks.get(key(tenantId, itemId, warehouseId))?.averageCost ?? 0;
  }

  withdraw(tenantId: string, itemId: string, warehouseId: string, quantity: number): void {
    const k = key(tenantId, itemId, warehouseId);

    this.withdrawn.set(k, (this.withdrawn.get(k) ?? 0) + quantity);
    const current = this.stocks.get(k);
    if (current) {
      this.stocks.set(k, { quantity: current.quantity - quantity, averageCost: current.averageCost });
    }
  }

  // Borradores: no pisan una orden o una entrada que entretanto cambio de estado.
  private async saveDraft(document: PurchaseOrder | GoodsReceipt | PurchaseReturn): Promise<void> {
    if (document instanceof PurchaseOrder) {
      const stored = this.orderRows.get(document.id.value);

      if (stored && stored.status !== 'draft') throw new PurchaseOrderNotEditableError(stored.id, stored.status);
      if (stored && stored.updatedAt.getTime() !== document.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

      this.orderRows.set(document.id.value, structuredClone(document.toPrimitives()));
      return;
    }

    if (document instanceof PurchaseReturn) {
      const stored = this.returnRows.get(document.id.value);

      if (stored && stored.status !== 'draft') throw new PurchaseReturnNotEditableError(stored.id, stored.status);
      if (stored && stored.updatedAt.getTime() !== document.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

      this.returnRows.set(document.id.value, structuredClone(document.toPrimitives()));
      return;
    }

    const stored = this.receiptRows.get(document.id.value);

    if (stored && stored.status !== 'draft') throw new GoodsReceiptNotEditableError(stored.id, stored.status);
    if (stored && stored.updatedAt.getTime() !== document.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

    this.receiptRows.set(document.id.value, structuredClone(document.toPrimitives()));
  }

  updateConfirmedOrder(order: PurchaseOrder): void {
    this.orderRows.set(order.id.value, structuredClone(order.toPrimitives()));
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
      searchPage: async (tenantId, criteria) => {
        const text = criteria.text?.toLowerCase() ?? null;
        const matches = [...this.orderRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !criteria.supplierId || row.supplierId === criteria.supplierId)
          .filter((row) => !criteria.warehouseId || row.warehouseId === criteria.warehouseId)
          .filter((row) => !criteria.status || row.status === criteria.status)
          .filter((row) => !criteria.from || row.orderDate >= criteria.from)
          .filter((row) => !criteria.to || row.orderDate <= criteria.to)
          .filter(
            (row) =>
              text === null ||
              row.code.toLowerCase().includes(text) ||
              row.lines.some((line) => line.itemSku.toLowerCase().includes(text) || line.itemName.toLowerCase().includes(text)),
          )
          .sort((a, b) => b.code.localeCompare(a.code));

        return {
          orders: matches
            .slice(criteria.offset, criteria.offset + criteria.limit)
            .map((row) => PurchaseOrder.fromPrimitives(structuredClone(row))),
          total: matches.length,
        };
      },
      searchOpen: async (tenantId, warehouseId) =>
        [...this.orderRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => row.status === 'confirmed' || row.status === 'partially_received')
          .filter((row) => !warehouseId || row.warehouseId === warehouseId)
          .sort((a, b) => a.code.localeCompare(b.code))
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
      searchPage: async (tenantId, criteria) => {
        const text = criteria.text?.toLowerCase() ?? null;
        const codeOf = (orderId: string) => this.orderRows.get(orderId)?.code ?? '';
        const matches = [...this.receiptRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !criteria.orderId || row.orderId === criteria.orderId)
          .filter((row) => !criteria.warehouseId || row.warehouseId === criteria.warehouseId)
          .filter((row) => !criteria.status || row.status === criteria.status)
          .filter((row) => !criteria.from || row.receiptDate >= criteria.from)
          .filter((row) => !criteria.to || row.receiptDate <= criteria.to)
          .filter((row) => text === null || row.code.toLowerCase().includes(text) || codeOf(row.orderId).toLowerCase().includes(text))
          .sort((a, b) => b.code.localeCompare(a.code));

        return {
          receipts: matches
            .slice(criteria.offset, criteria.offset + criteria.limit)
            .map((row) => GoodsReceipt.fromPrimitives(structuredClone(row))),
          total: matches.length,
        };
      },
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

  private loadReturn(tenantId: TenantId, id: PurchaseReturnId): PurchaseReturn | null {
    const row = this.returnRows.get(id.value);

    return row && row.tenantId === tenantId.value ? PurchaseReturn.fromPrimitives(structuredClone(row)) : null;
  }

  get returns(): PurchaseReturnRepository {
    return {
      save: (document) => this.saveDraft(document),
      find: async (tenantId, id) => this.loadReturn(tenantId, id),
      searchPage: async (tenantId, criteria) => {
        const text = criteria.text?.toLowerCase() ?? null;
        const matches = [...this.returnRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !criteria.supplierId || row.supplierId === criteria.supplierId)
          .filter((row) => !criteria.receiptId || row.receiptId === criteria.receiptId)
          .filter((row) => !criteria.status || row.status === criteria.status)
          .filter((row) => !criteria.from || row.returnDate >= criteria.from)
          .filter((row) => !criteria.to || row.returnDate <= criteria.to)
          .filter((row) => text === null || row.code.toLowerCase().includes(text))
          .sort((a, b) => b.code.localeCompare(a.code));

        return {
          returns: matches
            .slice(criteria.offset, criteria.offset + criteria.limit)
            .map((row) => PurchaseReturn.fromPrimitives(structuredClone(row))),
          total: matches.length,
        };
      },
      returnedQuantitiesByReceipt: async (tenantId, receiptId, excludeReturnId) => {
        const result = new Map<string, number>();
        for (const row of this.returnRows.values()) {
          if (
            row.tenantId === tenantId.value &&
            row.receiptId === receiptId &&
            row.status === 'confirmed' &&
            (!excludeReturnId || row.id !== excludeReturnId)
          ) {
            for (const line of row.lines) {
              result.set(line.receiptLineId, (result.get(line.receiptLineId) ?? 0) + line.quantity);
            }
          }
        }
        return result;
      },
    };
  }

  get returnPosting(): PurchaseReturnPosting {
    return {
      confirm: (tenantId, returnId, now) =>
        this.serial(async () => {
          const returnDoc = this.loadReturn(tenantId, returnId);
          if (!returnDoc) throw new PurchaseReturnNotFoundError(returnId.value);
          if (returnDoc.currentStatus() !== 'draft') {
            throw new PurchaseReturnNotConfirmableError(returnDoc.id.value, returnDoc.currentStatus());
          }

          const receipt = this.loadReceipt(tenantId, returnDoc.receiptId);
          if (!receipt) throw new ReceiptNotReturnableError(returnDoc.receiptId.value, 'none');
          if (receipt.currentStatus() !== 'confirmed') {
            throw new ReceiptNotReturnableError(receipt.id.value, receipt.currentStatus());
          }

          const order = this.loadOrder(tenantId, receipt.orderId);
          if (!order || order.supplierId().value !== returnDoc.supplierId.value) {
            throw new PurchaseReturnSupplierMismatchError(receipt.id.value, returnDoc.supplierId.value);
          }

          if (returnDoc.returnDate().value < receipt.date().value) {
            throw new ReturnBeforeReceiptError(receipt.id.value, returnDoc.returnDate().value, receipt.date().value);
          }

          const returnedMap = await this.returns.returnedQuantitiesByReceipt(tenantId, returnDoc.receiptId.value, returnDoc.id.value);
          const receiptPrimitives = receipt.toPrimitives();

          for (const line of returnDoc.lines()) {
            const receiptLine = receiptPrimitives.lines.find((rl) => rl.id === line.receiptLineId);
            if (!receiptLine) {
              throw new ReceiptLineNotFoundError(line.receiptLineId);
            }
            const alreadyReturned = returnedMap.get(line.receiptLineId) ?? 0;
            const availableQuota = receiptLine.quantity - alreadyReturned;

            if (line.quantity.toNumber() > availableQuota + 1e-6) {
              throw new QuantityExceedsReceiptReturnQuotaError(
                line.receiptLineId,
                availableQuota,
                line.quantity.toNumber(),
              );
            }

            if (this.stockOf(tenantId.value, line.itemId.value, returnDoc.warehouseId.value) < line.baseQuantity.toNumber()) {
              throw new ReceivedGoodsAlreadyUsedError(returnDoc.receiptId.value);
            }
          }

          const restoreMap = new Map<string, string>();
          for (const line of returnDoc.lines()) {
            restoreMap.set(line.id.value, `mv-${line.id.value}`);
            const baseQty = line.baseQuantity.toNumber();
            const returnedValue = line.quantity.toNumber() * line.unitCost.toNumber();
            const unitCostBase = baseQty > 0 ? returnedValue / baseQty : 0;
            this.stockLines.push({
              returnId: returnDoc.id.value,
              tenantId: tenantId.value,
              itemId: line.itemId.value,
              warehouseId: returnDoc.warehouseId.value,
              quantity: -baseQty,
              unitCost: unitCostBase,
              reversed: false,
            });

            const k = key(tenantId.value, line.itemId.value, returnDoc.warehouseId.value);
            const current = this.stocks.get(k) ?? { quantity: 0, averageCost: 0 };
            const remainingQty = current.quantity - baseQty;
            const remainingVal = current.quantity * current.averageCost - returnedValue;
            const avg = remainingQty > 0 ? (remainingVal <= 0 ? 0 : remainingVal / remainingQty) : current.averageCost;
            this.stocks.set(k, { quantity: remainingQty, averageCost: avg });
          }

          returnDoc.confirm(now, restoreMap);
          this.returnRows.set(returnDoc.id.value, structuredClone(returnDoc.toPrimitives()));
          return returnDoc;
        }),

      cancel: (tenantId, returnId, now) =>
        this.serial(async () => {
          const returnDoc = this.loadReturn(tenantId, returnId);
          if (!returnDoc) throw new PurchaseReturnNotFoundError(returnId.value);
          if (returnDoc.currentStatus() === 'cancelled') {
            throw new PurchaseReturnAlreadyCancelledError(returnDoc.id.value);
          }

          const wasConfirmed = returnDoc.currentStatus() === 'confirmed';
          if (wasConfirmed) {
            for (const line of this.stockLines) {
              if (line.returnId === returnDoc.id.value && !line.reversed) {
                line.reversed = true;
                const k = key(line.tenantId, line.itemId, line.warehouseId);
                const current = this.stocks.get(k) ?? { quantity: 0, averageCost: 0 };
                const q = Math.abs(line.quantity);
                const val = q * line.unitCost;
                const totalQty = current.quantity + q;
                const totalVal = current.quantity * current.averageCost + val;
                const avg = totalQty > 0 ? totalVal / totalQty : current.averageCost;
                this.stocks.set(k, { quantity: totalQty, averageCost: avg });
              }
            }
          }

          returnDoc.cancel(now);
          this.returnRows.set(returnDoc.id.value, structuredClone(returnDoc.toPrimitives()));
          return returnDoc;
        }),
    };
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
            for (const entry of result.stock.entries) {
              const q = entry.quantity.toNumber();
              const c = entry.unitCost.toNumber();
              newLines.push({
                receiptId: receipt.id.value,
                tenantId: tenantId.value,
                itemId: entry.itemId.value,
                warehouseId: entry.warehouseId.value,
                quantity: q,
                unitCost: c,
                reversed: false,
              });

              const k = key(tenantId.value, entry.itemId.value, entry.warehouseId.value);
              const current = this.stocks.get(k) ?? { quantity: 0, averageCost: 0 };
              const totalQty = current.quantity + q;
              const totalVal = current.quantity * current.averageCost + q * c;
              const avg = totalQty > 0 ? totalVal / totalQty : current.averageCost;
              this.stocks.set(k, { quantity: totalQty, averageCost: avg });
            }
          }

          const reversing = result.stock.kind === 'reverse' ? this.stockLines.filter((line) => line.receiptId === receipt.id.value && !line.reversed) : [];

          if (result.stock.kind === 'reverse' && this.confirmedInvoicesChecker) {
            const receiptLineIds = receipt.lines().map((l) => l.id.value);
            if (await this.confirmedInvoicesChecker(receiptLineIds)) {
              throw new GoodsReceiptHasConfirmedInvoicesError(receipt.id.value);
            }
          }

          // Como el inventario de verdad: no se revierte lo que ya salio.
          for (const line of reversing) {
            if (this.stockOf(line.tenantId, line.itemId, line.warehouseId) < line.quantity) {
              throw new ReceivedGoodsAlreadyUsedError(receipt.id.value);
            }
          }

          // Nada se escribe hasta que todo lo anterior paso: es la transaccion.
          for (const line of reversing) {
            line.reversed = true;
            const k = key(line.tenantId, line.itemId, line.warehouseId);
            const current = this.stocks.get(k) ?? { quantity: 0, averageCost: 0 };
            const q = line.quantity;
            const c = line.unitCost;
            const remainingQty = current.quantity - q;
            const remainingVal = current.quantity * current.averageCost - q * c;
            const avg = remainingQty > 0 ? (remainingVal <= 0 ? 0 : remainingVal / remainingQty) : current.averageCost;
            this.stocks.set(k, { quantity: remainingQty, averageCost: avg });
          }
          this.stockLines.push(...newLines);
          this.receiptRows.set(receipt.id.value, structuredClone(result.receipt.toPrimitives()));
          this.orderRows.set(order.id.value, structuredClone(result.order.toPrimitives()));
        }),
    };
  }

  // En serie, como el bloqueo de filas de la base.
  private serial<T = void>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
