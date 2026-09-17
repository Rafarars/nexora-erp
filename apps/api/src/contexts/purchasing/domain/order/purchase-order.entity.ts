import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  EmptyPurchaseOrderError,
  ExpectedDateBeforeOrderError,
  PurchaseOrderNotCancellableError,
  PurchaseOrderNotConfirmableError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotReceivableError,
  PurchaseOrderWithReceiptsError,
  ReceiptExceedsPendingError,
  ReceiptLineNotInOrderError,
} from '../errors/purchasing.errors.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { centsToNumber } from '../shared/money.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { Quantity } from '../shared/quantity.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { PurchaseOrderLine, PurchaseOrderLineId, PurchaseOrderLinePrimitives } from './purchase-order-line.js';

export class PurchaseOrderId extends Uuid {
  static of(value: string): PurchaseOrderId {
    return new PurchaseOrderId(value);
  }
}

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderDetails {
  supplierId: SupplierId;
  warehouseId: WarehouseRef;
  orderDate: PurchaseDate;
  expectedDate: PurchaseDate | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
  currency: DocumentCurrency;
}

export interface PurchaseOrderPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  warehouseId: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  status: PurchaseOrderStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: PurchaseOrderLinePrimitives[];
}

// Lo que se recibe de una linea en una entrada, en la unidad de la linea.
export interface ReceivedLine {
  orderLineId: PurchaseOrderLineId;
  quantity: Quantity;
}

const NOTES_MAX = 500;

// El pedido a un proveedor. No mueve existencia: confirmada, anuncia lo que viene en camino.
// Las entradas confirmadas la llevan a recibida en parte o del todo, y anular una entrada
// la devuelve al estado que corresponda a lo que quede recibido.
//
//   borrador → confirmada → recibida en parte ⇄ recibida
//       ↘           ↘
//        anulada ← (solo si no se recibio nada)
export class PurchaseOrder {
  private constructor(
    readonly id: PurchaseOrderId,
    readonly tenantId: TenantId,
    readonly code: string,
    private details: PurchaseOrderDetails,
    private status: PurchaseOrderStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(id: PurchaseOrderId, tenantId: TenantId, code: string, details: PurchaseOrderDetails, now: Date, today: string): PurchaseOrder {
    return new PurchaseOrder(id, tenantId, code, validated(details, today), 'draft', null, null, now, now);
  }

  static fromPrimitives(row: PurchaseOrderPrimitives): PurchaseOrder {
    return new PurchaseOrder(
      PurchaseOrderId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      {
        supplierId: SupplierId.of(row.supplierId),
        warehouseId: WarehouseRef.of(row.warehouseId),
        orderDate: PurchaseDate.of(row.orderDate),
        expectedDate: row.expectedDate ? PurchaseDate.of(row.expectedDate) : null,
        notes: row.notes,
        currency: DocumentCurrency.fromPrimitives(row),
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => PurchaseOrderLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  toPrimitives(): PurchaseOrderPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      supplierId: this.details.supplierId.value,
      warehouseId: this.details.warehouseId.value,
      orderDate: this.details.orderDate.value,
      expectedDate: this.details.expectedDate?.value ?? null,
      notes: this.details.notes,
      ...this.details.currency.toPrimitives(),
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

  currentStatus(): PurchaseOrderStatus {
    return this.status;
  }

  supplierId(): SupplierId {
    return this.details.supplierId;
  }

  warehouseId(): WarehouseRef {
    return this.details.warehouseId;
  }

  orderDate(): PurchaseDate {
    return this.details.orderDate;
  }

  expectedDate(): PurchaseDate | null {
    return this.details.expectedDate;
  }

  notes(): string | null {
    return this.details.notes;
  }

  currency(): DocumentCurrency {
    return this.details.currency;
  }

  lines(): PurchaseOrderLine[] {
    return [...this.details.lines];
  }

  line(id: PurchaseOrderLineId): PurchaseOrderLine {
    const line = this.details.lines.find((candidate) => candidate.id.equals(id));

    if (!line) throw new ReceiptLineNotInOrderError(id.value);

    return line;
  }

  // Confirmada y con algo pendiente: lo unico que puede recibir mercancia.
  isReceivable(): boolean {
    return this.status === 'confirmed' || this.status === 'partially_received';
  }

  totals(): { subtotal: number; tax: number; total: number } {
    const subtotal = this.details.lines.reduce((sum, line) => sum + line.subtotalCents(), 0n);
    const tax = this.details.lines.reduce((sum, line) => sum + line.taxCents(), 0n);

    return { subtotal: centsToNumber(subtotal), tax: centsToNumber(tax), total: centsToNumber(subtotal + tax) };
  }

  update(details: PurchaseOrderDetails, now: Date, today: string): void {
    if (this.status !== 'draft') throw new PurchaseOrderNotEditableError(this.id.value, this.status);

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  confirm(now: Date): void {
    if (this.status !== 'draft') throw new PurchaseOrderNotConfirmableError(this.id.value, this.status);

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status !== 'draft' && this.status !== 'confirmed') {
      if (this.status === 'partially_received' || this.status === 'received') {
        throw new PurchaseOrderWithReceiptsError(this.id.value);
      }

      throw new PurchaseOrderNotCancellableError(this.id.value, this.status);
    }

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }

  // Todas las lineas se validan antes de tocar ninguna: una entrada que se pasa en la
  // tercera linea no deja registradas las dos primeras.
  registerReceipt(received: ReceivedLine[], now: Date): void {
    if (!this.isReceivable()) throw new PurchaseOrderNotReceivableError(this.id.value, this.status);

    const requested = new Map<string, Quantity>();

    for (const { orderLineId, quantity } of received) {
      const line = this.line(orderLineId);
      const total = (requested.get(line.id.value) ?? Quantity.zero()).plus(quantity);

      if (total.isGreaterThan(line.pending())) {
        throw new ReceiptExceedsPendingError(line.id.value, line.pending().toNumber(), total.toNumber());
      }

      requested.set(line.id.value, total);
    }

    for (const { orderLineId, quantity } of received) this.line(orderLineId).receive(quantity);

    this.recomputeStatus(now);
  }

  revertReceipt(received: ReceivedLine[], now: Date): void {
    if (this.status !== 'partially_received' && this.status !== 'received') {
      throw new PurchaseOrderNotReceivableError(this.id.value, this.status);
    }

    for (const { orderLineId, quantity } of received) this.line(orderLineId).unreceive(quantity);

    this.recomputeStatus(now);
  }

  private recomputeStatus(now: Date): void {
    const lines = this.details.lines;

    if (lines.every((line) => line.isFullyReceived())) {
      this.status = 'received';
    } else if (lines.every((line) => line.receivedQuantity().isZero())) {
      this.status = 'confirmed';
    } else {
      this.status = 'partially_received';
    }

    this.updatedAt = now;
  }
}

function validated(details: PurchaseOrderDetails, today: string): PurchaseOrderDetails {
  if (details.lines.length === 0) throw new EmptyPurchaseOrderError();

  details.orderDate.ensureNotAfter(today);

  // La fecha esperada si puede ser futura: es cuando el proveedor promete entregar.
  if (details.expectedDate && details.expectedDate.isBefore(details.orderDate)) {
    throw new ExpectedDateBeforeOrderError(details.expectedDate.value, details.orderDate.value);
  }

  return { ...details, notes: optionalText(details.notes, NOTES_MAX, 'PurchaseOrderNotes') };
}
