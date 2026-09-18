import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  DispatchAlreadyInvoicedError,
  DispatchNotInvoiceableError,
  InvoiceAlreadyCancelledError,
  InvoiceWithPaymentsError,
  NothingToInvoiceError,
  OrderNotDirectlyInvoiceableError,
  SalesOrderNotInvoiceableError,
} from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { CustomerCredit, ensureCreditAllows } from './credit/customer-credit.js';
import { Dispatch, DispatchId } from '../dispatch/dispatch.entity.js';
import { SalesOrder, SalesOrderId } from '../order/sales-order.entity.js';
import { SalesOrderLineId } from '../order/sales-order-line.js';
import { Quantity } from '../shared/quantity.vo.js';
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
  // De que linea del pedido sale. Anular devuelve lo facturado a esa linea.
  orderLineId: string;
  itemId: string;
  // La factura se reimprime como se emitio, aunque el articulo cambie de nombre despues.
  itemSku: string;
  itemName: string;
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
  // Nulo cuando el pedido solo vende servicios: no hay despacho del que nacer.
  dispatchId: string | null;
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
  // Sin despacho cuando el pedido solo vende servicios.
  dispatch: Dispatch | null;
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

    if (dispatch) {
      if (dispatch.currentStatus() !== 'confirmed') throw new DispatchNotInvoiceableError(dispatch.id.value, dispatch.currentStatus());
      if (issue.alreadyInvoiced) throw new DispatchAlreadyInvoicedError(dispatch.id.value);
    } else {
      // Sin despacho solo se factura un pedido que no saca nada de la bodega...
      if (order.movesStock()) throw new OrderNotDirectlyInvoiceableError(order.id.value);
      // ...y que ya este confirmado: un borrador se sigue editando, y facturarlo dejaria cobrado
      // algo que todavia puede cambiar de precio, de cantidad o desaparecer.
      if (!order.isInvoiceable()) throw new SalesOrderNotInvoiceableError(order.id.value, order.currentStatus());
    }

    issue.date.ensureNotAfter(today);

    const decimals = issue.amountDecimals;

    const invoiced = order.linesToInvoice(dispatch ? dispatch.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })) : null);

    if (invoiced.length === 0) throw new NothingToInvoiceError(order.id.value);

    const lines = invoiced.map(({ line: orderLine, quantity }, index) => {
      const subtotal = lineSubtotalUnits(quantity, orderLine.unitPrice, decimals);

      return {
        id: issue.lineIds(),
        lineNumber: index + 1,
        orderLineId: orderLine.id.value,
        itemId: orderLine.itemId.value,
        // El SKU y el nombre con que se escribio la linea del pedido.
        itemSku: orderLine.itemSku,
        itemName: orderLine.itemName,
        unitId: orderLine.unitId.value,
        quantity: quantity.toNumber(),
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
      dispatchId: dispatch?.id.value ?? null,
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

  dispatchId(): DispatchId | null {
    return this.row.dispatchId === null ? null : DispatchId.of(this.row.dispatchId);
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

  // Lo que cada linea cobro, para devolverlo al pedido si la factura se anula.
  invoicedLines(): { orderLineId: SalesOrderLineId; quantity: Quantity }[] {
    return this.row.lines.map((line) => ({ orderLineId: SalesOrderLineId.of(line.orderLineId), quantity: Quantity.of(line.quantity) }));
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
