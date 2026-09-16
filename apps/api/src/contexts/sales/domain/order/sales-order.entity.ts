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
} from '../errors/sales.errors.js';
import { CustomerId } from '../customer/customer.entity.js';
import { baseToNumber } from '../shared/money.js';
import { Quantity } from '../shared/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from "../shared/document-currency.js";
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
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => SalesOrderLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
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
      status: this.status,
      confirmedAt: this.confirmedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lines: this.details.lines.map((line) => line.toPrimitives()),
    };
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

  totals(): { subtotal: number; tax: number; total: number } {
    const subtotal = this.details.lines.reduce((sum, line) => sum + line.subtotalBase(), 0n);
    const tax = this.details.lines.reduce((sum, line) => sum + line.taxBase(), 0n);

    return { subtotal: baseToNumber(subtotal), tax: baseToNumber(tax), total: baseToNumber(subtotal + tax) };
  }

  // Lo que el pedido reserva por articulo, en unidad base. Un borrador aun no reserva nada, pero
  // al confirmarse reservara esto.
  reservedByItem(): Map<string, Quantity> {
    const reserved = new Map<string, Quantity>();

    for (const line of this.details.lines) {
      reserved.set(line.itemId.value, (reserved.get(line.itemId.value) ?? Quantity.zero()).plus(line.pendingBase()));
    }

    return reserved;
  }

  update(details: SalesOrderDetails, now: Date, today: string): void {
    if (this.status !== 'draft') throw new SalesOrderNotEditableError(this.id.value, this.status);

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  // Que haya disponible lo comprueba StockReservation antes, con las existencias bloqueadas.
  confirm(now: Date): void {
    if (this.status !== 'draft') throw new SalesOrderNotConfirmableError(this.id.value, this.status);

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'partially_dispatched' || this.status === 'dispatched') {
      throw new SalesOrderWithDispatchesError(this.id.value);
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
