import { GoodsReceipt } from '../../domain/receipt/goods-receipt.entity.js';
import { PurchaseOrder } from '../../domain/order/purchase-order.entity.js';

type Decimalish = { toNumber(): number };

// Prisma devuelve decimal como objetos Decimal y fechas sin hora como Date a medianoche UTC.
const n = (value: Decimalish) => value.toNumber();
const day = (value: Date) => value.toISOString().slice(0, 10);

export const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export interface PurchaseOrderRow {
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
    unitId: string;
    quantity: Decimalish;
    baseQuantity: Decimalish;
    unitCost: Decimalish;
    taxRate: Decimalish;
    receivedQuantity: Decimalish;
  }[];
}

export function orderFromRow(row: PurchaseOrderRow): PurchaseOrder {
  return PurchaseOrder.fromPrimitives({
    ...row,
    orderDate: day(row.orderDate),
    expectedDate: row.expectedDate ? day(row.expectedDate) : null,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitCost: n(line.unitCost),
      taxRate: n(line.taxRate),
      receivedQuantity: n(line.receivedQuantity),
    })),
  });
}

export interface GoodsReceiptRow {
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
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      orderLineId: line.orderLineId,
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitCost: n(line.unitCost),
    })),
  });
}
