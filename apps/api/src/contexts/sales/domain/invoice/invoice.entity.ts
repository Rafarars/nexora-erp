import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { DispatchAlreadyInvoicedError, DispatchNotInvoiceableError, InvoiceAlreadyCancelledError, InvoiceWithPaymentsError } from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { CustomerCredit, ensureCreditAllows } from './credit/customer-credit.js';
import { Dispatch, DispatchId } from '../dispatch/dispatch.entity.js';
import { SalesOrder, SalesOrderId } from '../order/sales-order.entity.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { lineSubtotalUnits, taxUnits } from '../shared/money.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
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

export interface InvoicePrimitives extends DocumentCurrencyPrimitives {
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
  subtotalVes: number | null;
  taxVes: number | null;
  totalVes: number | null;
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
  // El plazo, el limite y la deuda del cliente de hoy, leidos con el cliente bloqueado.
  credit: CustomerCredit;
  date: SalesDate;
  // La moneda del pedido con las tasas del dia de emision.
  currency: DocumentCurrency;
  amountDecimals: number;
  notes: string | null;
  lineIds: () => string;
}

// La factura cobra lo que salio en un despacho, al precio y con el impuesto del pedido, en su
// moneda y con las tasas del dia en que se emite. Nace emitida y sus importes quedan escritos: un documento fiscal no cambia porque luego cambie un
// precio. No toca la existencia. Solo se anula.
export class Invoice {
  private constructor(private row: InvoicePrimitives) {}

  static issue(id: InvoiceId, tenantId: TenantId, code: string, issue: InvoiceIssue, now: Date, today: string): Invoice {
    const { dispatch, order } = issue;

    if (dispatch.currentStatus() !== 'confirmed') throw new DispatchNotInvoiceableError(dispatch.id.value, dispatch.currentStatus());
    if (issue.alreadyInvoiced) throw new DispatchAlreadyInvoicedError(dispatch.id.value);

    issue.date.ensureNotAfter(today);

    const decimals = issue.amountDecimals;
    const lines = dispatch.lines().map((line, index) => {
      const orderLine = order.line(line.orderLineId);
      const subtotal = lineSubtotalUnits(line.quantity, orderLine.unitPrice, decimals);

      return {
        id: issue.lineIds(),
        lineNumber: index + 1,
        itemId: line.itemId.value,
        unitId: line.unitId.value,
        quantity: line.quantity.toNumber(),
        unitPrice: orderLine.unitPrice.toNumber(),
        taxRate: orderLine.taxRate.toNumber(),
        subtotalUnits: subtotal,
        taxUnits: taxUnits(subtotal, orderLine.taxRate, decimals),
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.subtotalUnits, 0n);
    const tax = lines.reduce((sum, line) => sum + line.taxUnits, 0n);
    const { currency } = issue;

    ensureCreditAllows(issue.credit, currency.baseAmount(subtotal + tax, decimals));

    // Lo que exige la ley venezolana: base imponible e impuesto en bolivares, a la tasa de emision.
    const subtotalVes = currency.bolivars(subtotal, decimals);
    const taxVes = currency.bolivars(tax, decimals);
    const inBolivars = (units: bigint | null) => (units === null ? null : unitsToNumber(units));

    return new Invoice({
      id: id.value,
      tenantId: tenantId.value,
      code,
      dispatchId: dispatch.id.value,
      orderId: order.id.value,
      customerId: order.customerId().value,
      issueDate: issue.date.value,
      dueDate: issue.date.plusDays(issue.credit.paymentTermDays).value,
      ...currency.toPrimitives(),
      notes: optionalText(issue.notes, 500, 'InvoiceNotes'),
      status: 'issued',
      subtotal: unitsToNumber(subtotal),
      tax: unitsToNumber(tax),
      total: unitsToNumber(subtotal + tax),
      subtotalVes: inBolivars(subtotalVes),
      taxVes: inBolivars(taxVes),
      totalVes: subtotalVes === null || taxVes === null ? null : unitsToNumber(subtotalVes + taxVes),
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
      lines: lines.map(({ subtotalUnits, taxUnits: lineTax, ...line }) => ({
        ...line,
        subtotal: unitsToNumber(subtotalUnits),
        tax: unitsToNumber(lineTax),
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

  total(): number {
    return this.row.total;
  }

  // Lo cobrado se anula antes: si no, el cobro quedaria aplicado a una factura que no existe.
  cancel(now: Date, paid: number): void {
    if (this.row.status === 'cancelled') throw new InvoiceAlreadyCancelledError(this.row.id);
    if (paid > 0) throw new InvoiceWithPaymentsError(this.row.id);

    this.row = { ...this.row, status: 'cancelled', cancelledAt: now, updatedAt: now };
  }
}
