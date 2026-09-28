import { GoodsReceipt } from '../../domain/receipt/goods-receipt.entity.js';
import { PurchaseOrder } from '../../domain/order/purchase-order.entity.js';
import { PurchaseReturn } from '../../domain/return/purchase-return.entity.js';
import { PurchaseInvoice } from '../../domain/invoice/purchase-invoice.entity.js';

type Decimalish = { toNumber(): number };

// Prisma devuelve decimal como objetos Decimal y fechas sin hora como Date a medianoche UTC.
const n = (value: Decimalish) => value.toNumber();
const day = (value: Date) => value.toISOString().slice(0, 10);
const rate = (value: Decimalish | null) => (value === null ? null : value.toNumber());

interface CurrencyColumns {
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
}

export const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export interface PurchaseOrderRow extends CurrencyColumns {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  warehouseId: string;
  orderDate: Date;
  expectedDate: Date | null;
  notes: string | null;
  paymentTermDays: number;
  status: 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    itemId: string;
    itemSku: string;
    itemName: string;
    unitId: string;
    quantity: Decimalish;
    baseQuantity: Decimalish;
    unitCost: Decimalish;
    taxRate: Decimalish;
    receivedQuantity: Decimalish;
    invoicedQuantity?: Decimalish;
    movesStock: boolean;
  }[];
}

export function orderFromRow(row: PurchaseOrderRow): PurchaseOrder {
  return PurchaseOrder.fromPrimitives({
    ...row,
    orderDate: day(row.orderDate),
    expectedDate: row.expectedDate ? day(row.expectedDate) : null,
    exchangeRate: rate(row.exchangeRate),
    baseExchangeRate: rate(row.baseExchangeRate),
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      itemSku: line.itemSku,
      itemName: line.itemName,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitCost: n(line.unitCost),
      taxRate: n(line.taxRate),
      receivedQuantity: n(line.receivedQuantity),
      invoicedQuantity: line.invoicedQuantity ? n(line.invoicedQuantity) : 0,
      movesStock: line.movesStock,
    })),
  });
}

export interface GoodsReceiptRow extends CurrencyColumns {
  id: string;
  tenantId: string;
  code: string;
  orderId: string;
  warehouseId: string;
  receiptDate: Date;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    orderLineId: string;
    itemId: string;
    itemSku: string;
    itemName: string;
    unitId: string;
    quantity: Decimalish;
    baseQuantity: Decimalish;
    unitCost: Decimalish;
  }[];
}

export function receiptFromRow(row: GoodsReceiptRow): GoodsReceipt {
  return GoodsReceipt.fromPrimitives({
    ...row,
    receiptDate: day(row.receiptDate),
    exchangeRate: rate(row.exchangeRate),
    baseExchangeRate: rate(row.baseExchangeRate),
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      orderLineId: line.orderLineId,
      itemId: line.itemId,
      itemSku: line.itemSku,
      itemName: line.itemName,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitCost: n(line.unitCost),
    })),
  });
}

export const PURCHASE_RETURN_INCLUDE = { lines: { orderBy: { lineNumber: 'asc' } } } as const;

export interface PurchaseReturnRow extends CurrencyColumns {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  receiptId: string;
  warehouseId: string;
  returnDate: Date;
  reason: string | null;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    receiptLineId: string;
    itemId: string;
    itemSku: string;
    itemName: string;
    unitId: string;
    quantity: Decimalish;
    baseQuantity: Decimalish;
    unitCost: Decimalish;
    restoresMovementId: string | null;
  }[];
}

export function purchaseReturnFromRow(row: PurchaseReturnRow): PurchaseReturn {
  return PurchaseReturn.fromPrimitives({
    ...row,
    returnDate: day(row.returnDate),
    exchangeRate: rate(row.exchangeRate),
    baseExchangeRate: rate(row.baseExchangeRate),
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      receiptLineId: line.receiptLineId,
      itemId: line.itemId,
      itemSku: line.itemSku,
      itemName: line.itemName,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitCost: n(line.unitCost),
      restoresMovementId: line.restoresMovementId,
    })),
  });
}

export const PURCHASE_INVOICE_INCLUDE = { lines: { orderBy: { lineNumber: 'asc' } } } as const;

export interface PurchaseInvoiceRow extends CurrencyColumns {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceSeries: string | null;
  issueDate: Date;
  dueDate: Date;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: Decimalish;
  tax: Decimalish;
  total: Decimalish;
  subtotalVes: Decimalish | null;
  taxVes: Decimalish | null;
  totalVes: Decimalish | null;
  priceDifference: Decimalish;
  exchangeDifference: Decimalish;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    receiptLineId: string | null;
    orderLineId: string | null;
    itemId: string | null;
    itemSku: string | null;
    itemName: string;
    concept: string | null;
    unitId: string | null;
    quantity: Decimalish;
    unitPrice: Decimalish;
    taxRate: Decimalish;
    subtotal: Decimalish;
    tax: Decimalish;
    total: Decimalish;
  }[];
}

export function purchaseInvoiceFromRow(row: PurchaseInvoiceRow): PurchaseInvoice {
  return PurchaseInvoice.fromPrimitives({
    ...row,
    issueDate: day(row.issueDate),
    dueDate: day(row.dueDate),
    exchangeRate: rate(row.exchangeRate),
    baseExchangeRate: rate(row.baseExchangeRate),
    subtotal: n(row.subtotal),
    tax: n(row.tax),
    total: n(row.total),
    subtotalVes: row.subtotalVes ? n(row.subtotalVes) : null,
    taxVes: row.taxVes ? n(row.taxVes) : null,
    totalVes: row.totalVes ? n(row.totalVes) : null,
    priceDifference: n(row.priceDifference),
    exchangeDifference: n(row.exchangeDifference),
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      receiptLineId: line.receiptLineId,
      orderLineId: line.orderLineId,
      itemId: line.itemId,
      itemSku: line.itemSku,
      itemName: line.itemName,
      concept: line.concept,
      unitId: line.unitId,
      quantity: n(line.quantity),
      unitPrice: n(line.unitPrice),
      taxRate: n(line.taxRate),
      subtotal: n(line.subtotal),
      tax: n(line.tax),
      total: n(line.total),
    })),
  });
}


