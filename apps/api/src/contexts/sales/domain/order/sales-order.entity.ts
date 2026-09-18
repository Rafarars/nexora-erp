import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  DispatchExceedsPendingError,
  DispatchLineNotInOrderError,
  EmptySalesOrderError,
  SalesOrderNotCancellableError,
  SalesOrderNotConfirmableError,
  SalesOrderNotDispatchableError,
  SalesOrderNotEditableError,
  SalesOrderWithDispatchesError,
  SalesOrderWithInvoicesError,
} from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { Quantity } from '../shared/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SalesOrderLine, SalesOrderLineId, SalesOrderLinePrimitives } from './sales-order-line.js';

export class SalesOrderId extends Uuid {
  static of(value: string): SalesOrderId {
    return new SalesOrderId(value);
  }
}

export type SalesOrderStatus = 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled';

export interface SalesOrderDetails {
  customerId: CustomerId;
  warehouseId: WarehouseRef;
  orderDate: SalesDate;
  currency: DocumentCurrency;
  notes: string | null;
  // Con que lista se cotizo. Queda escrita para saber de donde salio cada precio.
  priceListId: string | null;
  lines: SalesOrderLine[];
}

export interface SalesOrderPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  warehouseId: string;
  orderDate: string;
  notes: string | null;
  priceListId: string | null;
  status: SalesOrderStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: SalesOrderLinePrimitives[];
}

export interface DispatchedLine {
  orderLineId: SalesOrderLineId;
  quantity: Quantity;
}

const NOTES_MAX = 500;

// Lo que un cliente pide de una bodega. No mueve existencia: confirmado, la reserva. Los
// despachos confirmados lo llevan a despachado en parte o del todo, y anular uno lo devuelve.
//
//   borrador → confirmado → despachado en parte ⇄ despachado
//       ↘          ↘
//        anulado ← (solo si no se despacho nada)
export class SalesOrder {
  private constructor(
    readonly id: SalesOrderId,
    readonly tenantId: TenantId,
    readonly code: string,
    private details: SalesOrderDetails,
    private status: SalesOrderStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(id: SalesOrderId, tenantId: TenantId, code: string, details: SalesOrderDetails, now: Date, today: string): SalesOrder {
    return new SalesOrder(id, tenantId, code, validated(details, today), 'draft', null, null, now, now);
  }

  static fromPrimitives(row: SalesOrderPrimitives): SalesOrder {
    return new SalesOrder(
      SalesOrderId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      {
        customerId: CustomerId.of(row.customerId),
        warehouseId: WarehouseRef.of(row.warehouseId),
        orderDate: SalesDate.of(row.orderDate),
        currency: DocumentCurrency.fromPrimitives(row),
        notes: row.notes,
        priceListId: row.priceListId,
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => SalesOrderLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  toPrimitives(): SalesOrderPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      customerId: this.details.customerId.value,
      warehouseId: this.details.warehouseId.value,
      orderDate: this.details.orderDate.value,
      ...this.details.currency.toPrimitives(),
      notes: this.details.notes,
      priceListId: this.details.priceListId,
      status: this.status,
      confirmedAt: this.confirmedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lines: this.details.lines.map((line) => line.toPrimitives()),
    };
  }

  // Guardar el borrador solo pisa esta version: si otra persona lo guardo entretanto, se rechaza.
  version(): Date | null {
    return this.loadedVersion;
  }

  currentStatus(): SalesOrderStatus {
    return this.status;
  }

  customerId(): CustomerId {
    return this.details.customerId;
  }

  warehouseId(): WarehouseRef {
    return this.details.warehouseId;
  }

  currency(): DocumentCurrency {
    return this.details.currency;
  }

  orderDate(): SalesDate {
    return this.details.orderDate;
  }

  notes(): string | null {
    return this.details.notes;
  }

  lines(): SalesOrderLine[] {
    return [...this.details.lines];
  }

  line(id: SalesOrderLineId): SalesOrderLine {
    const line = this.details.lines.find((candidate) => candidate.id.equals(id));

    if (!line) throw new DispatchLineNotInOrderError(id.value);

    return line;
  }

  // Confirmado y con algo pendiente: lo unico que reserva y lo unico que se despacha.
  isDispatchable(): boolean {
    return this.status === 'confirmed' || this.status === 'partially_dispatched';
  }

  // Con los decimales de la empresa: un pedido calcula sus importes al vuelo.
  totals(decimals: number): { subtotal: number; tax: number; total: number } {
    const subtotal = this.details.lines.reduce((sum, line) => sum + line.subtotalUnits(decimals), 0n);
    const tax = this.details.lines.reduce((sum, line) => sum + line.taxUnits(decimals), 0n);

    return { subtotal: unitsToNumber(subtotal), tax: unitsToNumber(tax), total: unitsToNumber(subtotal + tax) };
  }

  // Lo que el pedido reserva por articulo, en unidad base. Un borrador aun no reserva nada, pero
  // al confirmarse reservara esto.
  // Solo reserva lo que sale de la bodega: un servicio no ocupa existencia de nadie.
  reservedByItem(): Map<string, Quantity> {
    const reserved = new Map<string, Quantity>();

    for (const line of this.details.lines) {
      if (!line.movesStock) continue;

      reserved.set(line.itemId.value, (reserved.get(line.itemId.value) ?? Quantity.zero()).plus(line.pendingBase()));
    }

    return reserved;
  }

  // Que factura un despacho: lo que salio en el, y ademas los servicios del pedido que aun no se
  // cobraron. Un servicio no sale nunca en un despacho, asi que sin esto no se facturaria jamas.
  // Sin despacho —un pedido que solo vende servicios— se factura todo lo que queda pendiente.
  linesToInvoice(dispatched: { orderLineId: SalesOrderLineId; quantity: Quantity }[] | null): { line: SalesOrderLine; quantity: Quantity }[] {
    if (!dispatched) {
      return this.details.lines.filter((line) => !line.pendingToInvoice().isZero()).map((line) => ({ line, quantity: line.pendingToInvoice() }));
    }

    const services = this.details.lines
      .filter((line) => !line.movesStock && !line.pendingToInvoice().isZero())
      .map((line) => ({ line, quantity: line.pendingToInvoice() }));

    return [...dispatched.map(({ orderLineId, quantity }) => ({ line: this.line(orderLineId), quantity })), ...services];
  }

  // Una copia para la validacion previa: comprobar si la factura sale no debe dejar el pedido con
  // lo facturado ya sumado.
  copy(): SalesOrder {
    return SalesOrder.fromPrimitives(this.toPrimitives());
  }

  // Un borrador no se factura: se sigue editando, y lo cobrado dejaria de corresponderse con el.
  isInvoiceable(): boolean {
    return this.status === 'confirmed' || this.status === 'partially_dispatched' || this.status === 'dispatched';
  }

  movesStock(): boolean {
    return this.details.lines.some((line) => line.movesStock);
  }

  invoiceLines(invoiced: { orderLineId: SalesOrderLineId; quantity: Quantity }[], now: Date): void {
    for (const { orderLineId, quantity } of invoiced) this.line(orderLineId).invoice(quantity);

    this.updatedAt = now;
  }

  uninvoiceLines(invoiced: { orderLineId: SalesOrderLineId; quantity: Quantity }[], now: Date): void {
    for (const { orderLineId, quantity } of invoiced) this.line(orderLineId).uninvoice(quantity);

    this.updatedAt = now;
  }

  update(details: SalesOrderDetails, now: Date, today: string): void {
    if (this.status !== 'draft') throw new SalesOrderNotEditableError(this.id.value, this.status);

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  // Que haya disponible lo comprueba StockReservation antes, con las existencias bloqueadas.
  confirm(now: Date): void {
    if (this.status !== 'draft') throw new SalesOrderNotConfirmableError(this.id.value, this.status);

    this.confirmedAt = now;
    this.status = 'confirmed';
    // Un pedido que solo vende servicios nace despachado: no hay nada que sacar de la bodega.
    this.recomputeStatus(now);
  }

  cancel(now: Date): void {
    // Lo que impide anular es lo que ya salio o ya se cobro, no el estado: un pedido de solo
    // servicios nace despachado sin tener un solo despacho, y aun asi se puede anular.
    if (this.details.lines.some((line) => !line.dispatchedQuantity().isZero())) {
      throw new SalesOrderWithDispatchesError(this.id.value);
    }

    if (this.details.lines.some((line) => !line.invoicedQuantity().isZero())) {
      throw new SalesOrderWithInvoicesError(this.id.value);
    }

    if (this.status === 'cancelled') throw new SalesOrderNotCancellableError(this.id.value, this.status);

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }

  // Todas las lineas se validan antes de tocar ninguna.
  registerDispatch(dispatched: DispatchedLine[], now: Date): void {
    if (!this.isDispatchable()) throw new SalesOrderNotDispatchableError(this.id.value, this.status);

    const requested = new Map<string, Quantity>();

    for (const { orderLineId, quantity } of dispatched) {
      const line = this.line(orderLineId);
      const total = (requested.get(line.id.value) ?? Quantity.zero()).plus(quantity);

      if (total.isGreaterThan(line.pending())) {
        throw new DispatchExceedsPendingError(line.id.value, line.pending().toNumber(), total.toNumber());
      }

      requested.set(line.id.value, total);
    }

    for (const { orderLineId, quantity } of dispatched) this.line(orderLineId).dispatch(quantity);

    this.recomputeStatus(now);
  }

  revertDispatch(dispatched: DispatchedLine[], now: Date): void {
    if (this.status !== 'partially_dispatched' && this.status !== 'dispatched') {
      throw new SalesOrderNotDispatchableError(this.id.value, this.status);
    }

    for (const { orderLineId, quantity } of dispatched) this.line(orderLineId).undispatch(quantity);

    this.recomputeStatus(now);
  }

  private recomputeStatus(now: Date): void {
    const lines = this.details.lines;

    if (lines.every((line) => line.isFullyDispatched())) {
      this.status = 'dispatched';
    } else if (lines.every((line) => line.dispatchedQuantity().isZero())) {
      this.status = 'confirmed';
    } else {
      this.status = 'partially_dispatched';
    }

    this.updatedAt = now;
  }
}

function validated(details: SalesOrderDetails, today: string): SalesOrderDetails {
  if (details.lines.length === 0) throw new EmptySalesOrderError();

  details.orderDate.ensureNotAfter(today);

  return { ...details, notes: optionalText(details.notes, NOTES_MAX, 'SalesOrderNotes') };
}
