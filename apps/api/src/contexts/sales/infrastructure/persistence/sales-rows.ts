import { Dispatch } from '../../domain/dispatch/dispatch.entity.js';
import { Invoice } from '../../domain/invoice/invoice.entity.js';
import { SalesOrder } from '../../domain/order/sales-order.entity.js';

type Decimalish = { toNumber(): number };

// Prisma devuelve decimal como objetos Decimal y fechas sin hora como Date a medianoche UTC.
const n = (value: Decimalish) => value.toNumber();
const day = (value: Date) => value.toISOString().slice(0, 10);

export const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export interface SalesOrderRow {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  warehouseId: string;
  orderDate: Date;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled';
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
    unitPrice: Decimalish;
    taxRate: Decimalish;
    dispatchedQuantity: Decimalish;
  }[];
}

export function orderFromRow(row: SalesOrderRow): SalesOrder {
  return SalesOrder.fromPrimitives({
    ...row,
    orderDate: day(row.orderDate),
    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,
    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
      unitPrice: n(line.unitPrice),
      taxRate: n(line.taxRate),
      dispatchedQuantity: n(line.dispatchedQuantity),
    })),
  });
}

export interface DispatchRow {
  id: string;
  tenantId: string;
  code: string;
  orderId: string;
  warehouseId: string;
  dispatchDate: Date;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: { id: string; lineNumber: number; orderLineId: string; itemId: string; unitId: string; quantity: Decimalish; baseQuantity: Decimalish }[];
}

export function dispatchFromRow(row: DispatchRow): Dispatch {
  return Dispatch.fromPrimitives({
    ...row,
    dispatchDate: day(row.dispatchDate),
    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,
    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,
    lines: row.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      orderLineId: line.orderLineId,
      itemId: line.itemId,
      unitId: line.unitId,
      quantity: n(line.quantity),
      baseQuantity: n(line.baseQuantity),
    })),
  });
}

export interface InvoiceRow {
  id: string;
  tenantId: string;
  code: string;
  dispatchId: string;
  orderId: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  notes: string | null;
  status: 'issued' | 'cancelled';
  subtotal: Decimalish;
  tax: Decimalish;
  total: Decimalish;
  subtotalVes: Decimalish | null;
  taxVes: Decimalish | null;
  totalVes: Decimalish | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    itemId: string;
    unitId: string;
    quantity: Decimalish;
    unitPrice: Decimalish;
    taxRate: Decimalish;
    subtotal: Decimalish;
    tax: Decimalish;
  }[];
}

export function invoiceFromRow(row: InvoiceRow): Invoice {
  return Invoice.fromPrimitives({
    ...row,
    issueDate: day(row.issueDate),
    dueDate: day(row.dueDate),
    exchangeRate: row.exchangeRate ? n(row.exchangeRate) : null,
    baseExchangeRate: row.baseExchangeRate ? n(row.baseExchangeRate) : null,
    subtotal: n(row.subtotal),
    tax: n(row.tax),
    total: n(row.total),
    subtotalVes: row.subtotalVes ? n(row.subtotalVes) : null,
    taxVes: row.taxVes ? n(row.taxVes) : null,
    totalVes: row.totalVes ? n(row.totalVes) : null,
    lines: row.lines
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: n(line.quantity),
        unitPrice: n(line.unitPrice),
        taxRate: n(line.taxRate),
        subtotal: n(line.subtotal),
        tax: n(line.tax),
      })),
  });
}
