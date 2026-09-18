import { GoodsReceipt } from '../../domain/receipt/goods-receipt.entity.js';
import { PurchaseOrder } from '../../domain/order/purchase-order.entity.js';

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
