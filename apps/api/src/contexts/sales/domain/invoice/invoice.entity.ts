import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { DispatchAlreadyInvoicedError, DispatchNotInvoiceableError, InvoiceAlreadyCancelledError } from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { Dispatch, DispatchId } from '../dispatch/dispatch.entity.js';
import { SalesOrder, SalesOrderId } from '../order/sales-order.entity.js';
import { centsToNumber, lineSubtotalCents, taxCents } from '../shared/money.js';
import { ItemRef, UnitRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class InvoiceId extends Uuid {
  static of(value: string): InvoiceId {
    return new InvoiceId(value);
  }
}

export type InvoiceStatus = 'issued' | 'cancelled';

export interface InvoiceLinePrimitives {
  id: string;
  lineNumber: number;
  itemId: string;
  unitId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  tax: number;
}

export interface InvoicePrimitives {
  id: string;
  tenantId: string;
  code: string;
  dispatchId: string;
  orderId: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLinePrimitives[];
}

export interface InvoiceIssue {
  dispatch: Dispatch;
  order: SalesOrder;
  // Si el despacho ya tiene una factura emitida, leido con el despacho bloqueado.
  alreadyInvoiced: boolean;
  paymentTermDays: number;
  date: SalesDate;
  notes: string | null;
  lineIds: () => string;
}

// La factura cobra lo que salio en un despacho, al precio y con el impuesto del pedido. Nace
// emitida y sus importes quedan escritos: un documento fiscal no cambia porque luego cambie un
// precio. No toca la existencia. Solo se anula.
export class Invoice {
  private constructor(private row: InvoicePrimitives) {}

  static issue(id: InvoiceId, tenantId: TenantId, code: string, issue: InvoiceIssue, now: Date): Invoice {
    const { dispatch, order } = issue;

    if (dispatch.currentStatus() !== 'confirmed') throw new DispatchNotInvoiceableError(dispatch.id.value, dispatch.currentStatus());
    if (issue.alreadyInvoiced) throw new DispatchAlreadyInvoicedError(dispatch.id.value);

    issue.date.ensureNotAfter(now);

    const lines = dispatch.lines().map((line, index) => {
      const orderLine = order.line(line.orderLineId);
      const subtotal = lineSubtotalCents(line.quantity, orderLine.unitPrice);
      const tax = taxCents(subtotal, orderLine.taxRate);

      return {
        id: issue.lineIds(),
        lineNumber: index + 1,
        itemId: line.itemId.value,
        unitId: line.unitId.value,
        quantity: line.quantity.toNumber(),
        unitPrice: orderLine.unitPrice.toNumber(),
        taxRate: orderLine.taxRate.toNumber(),
        subtotalCents: subtotal,
        taxCents: tax,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.subtotalCents, 0n);
    const tax = lines.reduce((sum, line) => sum + line.taxCents, 0n);

    return new Invoice({
      id: id.value,
      tenantId: tenantId.value,
      code,
      dispatchId: dispatch.id.value,
      orderId: order.id.value,
      customerId: order.customerId().value,
      issueDate: issue.date.value,
      dueDate: issue.date.plusDays(issue.paymentTermDays).value,
      notes: optionalText(issue.notes, 500, 'InvoiceNotes'),
      status: 'issued',
      subtotal: centsToNumber(subtotal),
      tax: centsToNumber(tax),
      total: centsToNumber(subtotal + tax),
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      lines: lines.map(({ subtotalCents, taxCents: lineTax, ...line }) => ({
        ...line,
        subtotal: centsToNumber(subtotalCents),
        tax: centsToNumber(lineTax),
      })),
    });
  }

  static fromPrimitives(row: InvoicePrimitives): Invoice {
    return new Invoice(structuredClone(row));
  }

  toPrimitives(): InvoicePrimitives {
    return structuredClone(this.row);
  }

  get id(): InvoiceId {
    return InvoiceId.of(this.row.id);
  }

  dispatchId(): DispatchId {
    return DispatchId.of(this.row.dispatchId);
  }

  orderId(): SalesOrderId {
    return SalesOrderId.of(this.row.orderId);
  }

  customerId(): CustomerId {
    return CustomerId.of(this.row.customerId);
  }

  currentStatus(): InvoiceStatus {
    return this.row.status;
  }

  lineItems(): { itemId: ItemRef; unitId: UnitRef }[] {
    return this.row.lines.map((line) => ({ itemId: ItemRef.of(line.itemId), unitId: UnitRef.of(line.unitId) }));
  }

  cancel(now: Date): void {
    if (this.row.status === 'cancelled') throw new InvoiceAlreadyCancelledError(this.row.id);

    this.row = { ...this.row, status: 'cancelled', cancelledAt: now, updatedAt: now };
  }
}
