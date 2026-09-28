import {
  DuplicateSupplierInvoiceNumberError,
  InvoiceItemMismatchError,
  InvoiceLinesFromDifferentSupplierError,
  InvoiceQuantityExceedsOrderServiceError,
  InvoiceQuantityExceedsReceiptError,
  InvoiceReceiptNotConfirmedError,
  PurchaseInvoiceAlreadyCancelledError,
  PurchaseInvoiceNotCancellableError,
  PurchaseInvoiceNotConfirmableError,
  PurchaseInvoiceNotFoundError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseInvoicePosting } from '../../domain/invoice/posting/purchase-invoice-posting.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { PurchaseOrder, PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderLineId } from '../../domain/order/purchase-order-line.js';

export class InMemoryPurchaseInvoicePosting implements PurchaseInvoicePosting {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly invoices: PurchaseInvoiceRepository,
    private readonly receipts: GoodsReceiptRepository,
    private readonly orders: PurchaseOrderRepository,
    private readonly returns?: PurchaseReturnRepository,
    private readonly onSaveOrder?: (order: PurchaseOrder) => Promise<void> | void,
  ) {}

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async persistOrder(order: PurchaseOrder): Promise<void> {
    if (this.onSaveOrder) {
      await this.onSaveOrder(order);
    } else {
      await this.orders.save(order);
    }
  }

  async confirm(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date): Promise<PurchaseInvoice> {
    return this.serial(async () => {
      const invoice = await this.invoices.findById(tenantId, invoiceId);
    if (!invoice) throw new PurchaseInvoiceNotFoundError(invoiceId.value);

    if (invoice.currentStatus !== 'draft') {
      throw new PurchaseInvoiceNotConfirmableError(invoice.id.value, invoice.currentStatus);
    }

    const duplicate = await this.invoices.findActiveBySupplierNumber(
      tenantId,
      invoice.supplierId,
      invoice.supplierInvoiceNumber.value,
    );
    if (duplicate && !duplicate.id.equals(invoice.id)) {
      throw new DuplicateSupplierInvoiceNumberError(invoice.supplierId.value, invoice.supplierInvoiceNumber.value);
    }

    const lines = invoice.lines();
    const receiptLineIds = lines.map((l) => l.receiptLineId).filter((id): id is string => Boolean(id));
    const directOrderLineIds = lines.map((l) => l.orderLineId).filter((id): id is string => Boolean(id));

    const previouslyInvoicedReceipt = await this.invoices.invoicedQuantitiesByReceiptLine(
      tenantId,
      receiptLineIds,
      invoice.id.value,
    );

    const previouslyInvoicedOrder = await this.invoices.invoicedQuantitiesByOrderLine(
      tenantId,
      directOrderLineIds,
      invoice.id.value,
    );

    const orderDeltas = new Map<string, { orderId: string; delta: number }>();

    for (const line of lines) {
      const lineQty = line.quantity.toNumber();

      if (line.receiptLineId) {
        // Encontrar la entrada que contiene esta linea
        const allReceipts = await this.receipts.searchByTenant(tenantId);
        let foundReceipt = null;
        let foundReceiptLine = null;

        for (const r of allReceipts) {
          const matchingLine = r.lines().find((rl) => rl.id.value === line.receiptLineId);
          if (matchingLine) {
            foundReceipt = r;
            foundReceiptLine = matchingLine;
            break;
          }
        }

        if (!foundReceipt || !foundReceiptLine) {
          throw new InvoiceItemMismatchError(line.id.value, 'existing receipt', 'not found');
        }

        if (foundReceipt.currentStatus() !== 'confirmed') {
          throw new InvoiceReceiptNotConfirmedError(foundReceipt.id.value, foundReceipt.currentStatus());
        }

        const order = await this.orders.find(tenantId, foundReceipt.orderId);
        if (order && !order.supplierId().equals(invoice.supplierId)) {
          throw new InvoiceLinesFromDifferentSupplierError(order.supplierId().value, invoice.supplierId.value);
        }

        if (line.itemId && !line.itemId.equals(foundReceiptLine.itemId)) {
          throw new InvoiceItemMismatchError(line.id.value, foundReceiptLine.itemId.value, line.itemId.value);
        }
        if (line.unitId && !line.unitId.equals(foundReceiptLine.unitId)) {
          throw new InvoiceItemMismatchError(line.id.value, foundReceiptLine.unitId.value, line.unitId.value);
        }

        const returnedMap = this.returns
          ? await this.returns.returnedQuantitiesByReceipt(tenantId, foundReceipt.id.value)
          : new Map<string, number>();

        const received = foundReceiptLine.quantity.toNumber();
        const returned = returnedMap.get(line.receiptLineId) ?? 0;
        const alreadyInvoiced = previouslyInvoicedReceipt.get(line.receiptLineId) ?? 0;
        const available = Math.max(0, received - returned - alreadyInvoiced);

        if (lineQty > available) {
          throw new InvoiceQuantityExceedsReceiptError(line.receiptLineId, available, lineQty);
        }

        previouslyInvoicedReceipt.set(line.receiptLineId, alreadyInvoiced + lineQty);
        const orderLineId = foundReceiptLine.orderLineId.value;
        const existingDelta = orderDeltas.get(orderLineId)?.delta ?? 0;
        orderDeltas.set(orderLineId, { orderId: foundReceipt.orderId.value, delta: existingDelta + lineQty });
      } else if (line.orderLineId) {
        // Encontrar la orden que contiene esta linea
        const allOrders = await this.orders.searchByTenant(tenantId);
        let foundOrder = null;
        let foundOrderLine = null;

        for (const o of allOrders) {
          const matching = o.lines().find((ol) => ol.id.value === line.orderLineId);
          if (matching) {
            foundOrder = o;
            foundOrderLine = matching;
            break;
          }
        }

        if (!foundOrder || !foundOrderLine) {
          throw new InvoiceItemMismatchError(line.id.value, 'existing order', 'not found');
        }

        const ordered = foundOrderLine.quantity.toNumber();
        const alreadyInvoiced = previouslyInvoicedOrder.get(line.orderLineId) ?? 0;
        const available = Math.max(0, ordered - alreadyInvoiced);

        if (lineQty > available) {
          throw new InvoiceQuantityExceedsOrderServiceError(line.orderLineId, available, lineQty);
        }

        previouslyInvoicedOrder.set(line.orderLineId, alreadyInvoiced + lineQty);
        const existingDelta = orderDeltas.get(line.orderLineId)?.delta ?? 0;
        orderDeltas.set(line.orderLineId, { orderId: foundOrder.id.value, delta: existingDelta + lineQty });
      }
    }

    // Actualizar invoicedQuantity en las ordenes
    for (const [orderLineIdStr, { orderId, delta }] of orderDeltas) {
      const order = await this.orders.find(tenantId, PurchaseOrderId.of(orderId));
      if (order) {
        order.recordInvoice(PurchaseOrderLineId.of(orderLineIdStr), delta, now);
        await this.persistOrder(order);
      }
    }

    invoice.confirm(now);
    await this.invoices.save(invoice);
    return invoice;
    });
  }

  async cancel(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date): Promise<PurchaseInvoice> {
    return this.serial(async () => {
      const invoice = await this.invoices.findById(tenantId, invoiceId);
      if (!invoice) throw new PurchaseInvoiceNotFoundError(invoiceId.value);

      if (invoice.currentStatus === 'cancelled') {
        throw new PurchaseInvoiceAlreadyCancelledError(invoice.id.value);
      }
      if (invoice.currentStatus !== 'confirmed') {
        throw new PurchaseInvoiceNotCancellableError(invoice.id.value, invoice.currentStatus);
      }

      // Revertir cantidades en ordenes
      for (const line of invoice.lines()) {
        const lineQty = line.quantity.toNumber();
        if (line.receiptLineId) {
          const allReceipts = await this.receipts.searchByTenant(tenantId);
          for (const r of allReceipts) {
            const rl = r.lines().find((l) => l.id.value === line.receiptLineId);
            if (rl) {
              const order = await this.orders.find(tenantId, r.orderId);
              if (order) {
                order.revertInvoice(rl.orderLineId, lineQty, now);
                await this.persistOrder(order);
              }
              break;
            }
          }
        } else if (line.orderLineId) {
          const allOrders = await this.orders.searchByTenant(tenantId);
          for (const o of allOrders) {
            const ol = o.lines().find((l) => l.id.value === line.orderLineId);
            if (ol) {
              o.revertInvoice(ol.id, lineQty, now);
              await this.persistOrder(o);
              break;
            }
          }
        }
      }

      invoice.cancel(now);
      await this.invoices.save(invoice);
      return invoice;
    });
  }
}
