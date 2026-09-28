import { PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice-id.vo.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PurchaseInvoiceNotFoundError } from '../../domain/errors/purchasing.errors.js';

export interface ThreeWayMatchLineComparison {
  invoiceLineId: string;
  lineNumber: number;
  itemSku: string | null;
  itemName: string | null;
  concept: string | null;
  receiptLineId: string | null;
  receiptCode: string | null;
  orderLineId: string | null;
  orderCode: string | null;
  orderedQuantity: number | null;
  receivedQuantity: number | null;
  returnedQuantity: number | null;
  availableQuantity: number | null;
  invoicedQuantity: number;
  quantityMismatch: boolean;
  orderUnitPrice: number | null;
  receiptUnitCost: number | null;
  invoiceUnitPrice: number;
  priceDifference: number;
  priceMismatch: boolean;
}

export interface ThreeWayMatchResponse {
  invoiceId: string;
  invoiceCode: string;
  status: string;
  hasDiscrepancies: boolean;
  hasQuantityExceeded: boolean;
  totalPriceDifference: number;
  lines: ThreeWayMatchLineComparison[];
}

export class ThreeWayMatcher {
  constructor(
    private readonly invoices: PurchaseInvoiceRepository,
    private readonly receipts: GoodsReceiptRepository,
    private readonly orders: PurchaseOrderRepository,
    private readonly returns: PurchaseReturnRepository,
  ) {}

  async run(tenantIdStr: string, invoiceIdStr: string): Promise<ThreeWayMatchResponse> {
    const tenantId = TenantId.of(tenantIdStr);
    const invoiceId = PurchaseInvoiceId.of(invoiceIdStr);

    const invoice = await this.invoices.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new PurchaseInvoiceNotFoundError(invoiceIdStr);
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

    let hasDiscrepancies = false;
    let hasQuantityExceeded = false;
    let totalPriceDifference = 0;

    const allReceipts = receiptLineIds.length > 0 ? await this.receipts.searchByTenant(tenantId) : [];
    const allOrders = (receiptLineIds.length > 0 || directOrderLineIds.length > 0)
      ? await this.orders.searchByTenant(tenantId)
      : [];

    const returnedMapByReceipt = new Map<string, Map<string, number>>();

    const lineComparisons: ThreeWayMatchLineComparison[] = [];

    for (const line of lines) {
      const lineQty = line.quantity.toNumber();
      const linePrice = line.unitPrice.toNumber();

      if (line.receiptLineId) {
        let foundReceipt = null;
        let foundReceiptLine = null;

        for (const r of allReceipts) {
          const rl = r.lines().find((item) => item.id.value === line.receiptLineId);
          if (rl) {
            foundReceipt = r;
            foundReceiptLine = rl;
            break;
          }
        }

        let orderLine = null;
        let order = null;
        if (foundReceipt && foundReceiptLine) {
          order = allOrders.find((o) => o.id.equals(foundReceipt!.orderId)) ?? null;
          if (order) {
            orderLine = order.lines().find((ol) => ol.id.equals(foundReceiptLine!.orderLineId)) ?? null;
          }
        }

        let returnedMap = foundReceipt ? returnedMapByReceipt.get(foundReceipt.id.value) : undefined;
        if (!returnedMap && foundReceipt) {
          returnedMap = await this.returns.returnedQuantitiesByReceipt(tenantId, foundReceipt.id.value);
          returnedMapByReceipt.set(foundReceipt.id.value, returnedMap);
        }

        const received = foundReceiptLine ? foundReceiptLine.quantity.toNumber() : 0;
        const returned = returnedMap ? (returnedMap.get(line.receiptLineId) ?? 0) : 0;
        const alreadyInvoiced = previouslyInvoicedReceipt.get(line.receiptLineId) ?? 0;
        const available = Math.max(0, received - returned - alreadyInvoiced);

        const quantityMismatch = lineQty > available;
        if (quantityMismatch) {
          hasQuantityExceeded = true;
          hasDiscrepancies = true;
        }

        const receiptCost = foundReceiptLine ? foundReceiptLine.unitCost.toNumber() : linePrice;
        const orderPrice = orderLine ? orderLine.unitCost.toNumber() : receiptCost;
        const diffPerUnit = linePrice - receiptCost;
        const priceMismatch = Math.abs(diffPerUnit) > 0.0001 || Math.abs(linePrice - orderPrice) > 0.0001;

        if (priceMismatch) {
          hasDiscrepancies = true;
        }

        const lineDiffTotal = diffPerUnit * lineQty;
        totalPriceDifference += lineDiffTotal;

        lineComparisons.push({
          invoiceLineId: line.id.value,
          lineNumber: line.lineNumber,
          itemSku: line.itemSku,
          itemName: line.itemName,
          concept: line.concept,
          receiptLineId: line.receiptLineId,
          receiptCode: foundReceipt ? foundReceipt.code : null,
          orderLineId: orderLine ? orderLine.id.value : null,
          orderCode: order ? order.code : null,
          orderedQuantity: orderLine ? orderLine.quantity.toNumber() : null,
          receivedQuantity: received,
          returnedQuantity: returned,
          availableQuantity: available,
          invoicedQuantity: lineQty,
          quantityMismatch,
          orderUnitPrice: orderPrice,
          receiptUnitCost: receiptCost,
          invoiceUnitPrice: linePrice,
          priceDifference: diffPerUnit,
          priceMismatch,
        });
      } else if (line.orderLineId) {
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

        const ordered = foundOrderLine ? foundOrderLine.quantity.toNumber() : 0;
        const alreadyInvoiced = previouslyInvoicedOrder.get(line.orderLineId) ?? 0;
        const available = Math.max(0, ordered - alreadyInvoiced);

        const quantityMismatch = lineQty > available;
        if (quantityMismatch) {
          hasQuantityExceeded = true;
          hasDiscrepancies = true;
        }

        const orderPrice = foundOrderLine ? foundOrderLine.unitCost.toNumber() : linePrice;
        const diffPerUnit = linePrice - orderPrice;
        const priceMismatch = Math.abs(diffPerUnit) > 0.0001;

        if (priceMismatch) {
          hasDiscrepancies = true;
        }

        lineComparisons.push({
          invoiceLineId: line.id.value,
          lineNumber: line.lineNumber,
          itemSku: line.itemSku,
          itemName: line.itemName,
          concept: line.concept,
          receiptLineId: null,
          receiptCode: null,
          orderLineId: line.orderLineId,
          orderCode: foundOrder ? foundOrder.code : null,
          orderedQuantity: ordered,
          receivedQuantity: null,
          returnedQuantity: null,
          availableQuantity: available,
          invoicedQuantity: lineQty,
          quantityMismatch,
          orderUnitPrice: orderPrice,
          receiptUnitCost: null,
          invoiceUnitPrice: linePrice,
          priceDifference: diffPerUnit,
          priceMismatch,
        });
      } else {
        // Concepto / gasto libre
        lineComparisons.push({
          invoiceLineId: line.id.value,
          lineNumber: line.lineNumber,
          itemSku: null,
          itemName: null,
          concept: line.concept,
          receiptLineId: null,
          receiptCode: null,
          orderLineId: null,
          orderCode: null,
          orderedQuantity: null,
          receivedQuantity: null,
          returnedQuantity: null,
          availableQuantity: null,
          invoicedQuantity: lineQty,
          quantityMismatch: false,
          orderUnitPrice: null,
          receiptUnitCost: null,
          invoiceUnitPrice: linePrice,
          priceDifference: 0,
          priceMismatch: false,
        });
      }
    }

    return {
      invoiceId: invoice.id.value,
      invoiceCode: invoice.code,
      status: invoice.currentStatus,
      hasDiscrepancies,
      hasQuantityExceeded,
      totalPriceDifference: Math.round(totalPriceDifference * 10000) / 10000,
      lines: lineComparisons,
    };
  }
}
