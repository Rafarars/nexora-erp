import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  DispatchAlreadyCancelledError,
  DispatchInvoicedError,
  DispatchNotConfirmableError,
  DispatchNotEditableError,
  DuplicateDispatchLineError,
  EmptyDispatchError,
} from '../errors/sales.errors.js';
import { SalesOrderId } from '../order/sales-order.entity.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from "../shared/document-currency.js";
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { DispatchLine, DispatchLinePrimitives } from './dispatch-line.js';

export class DispatchId extends Uuid {
  static of(value: string): DispatchId {
    return new DispatchId(value);
  }
}

export type DispatchStatus = 'draft' | 'confirmed' | 'cancelled';

export interface DispatchDetails {
  date: SalesDate;
  currency: DocumentCurrency;
  notes: string | null;
  lines: DispatchLine[];
}

export interface DispatchPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  orderId: string;
  warehouseId: string;
  dispatchDate: string;
  notes: string | null;
  status: DispatchStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: DispatchLinePrimitives[];
}

const NOTES_MAX = 500;

// Lo que salio de un pedido, desde la bodega del pedido. borrador (no mueve nada) → confirmado
// (bajo la existencia) → anulado (la devolvio). Uno facturado no se anula: primero su factura.
export class Dispatch {
  private constructor(
    readonly id: DispatchId,
    readonly tenantId: TenantId,
    readonly code: string,
    readonly orderId: SalesOrderId,
    readonly warehouseId: WarehouseRef,
    private details: DispatchDetails,
    private status: DispatchStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: DispatchId,
    tenantId: TenantId,
    code: string,
    order: { id: SalesOrderId; warehouseId: WarehouseRef },
    details: DispatchDetails,
    now: Date,
    today: string,
  ): Dispatch {
    return new Dispatch(id, tenantId, code, order.id, order.warehouseId, validated(details, today), 'draft', null, null, now, now);
  }

  static fromPrimitives(row: DispatchPrimitives): Dispatch {
    return new Dispatch(
      DispatchId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      SalesOrderId.of(row.orderId),
      WarehouseRef.of(row.warehouseId),
      {
        date: SalesDate.of(row.dispatchDate),
        currency: DocumentCurrency.fromPrimitives(row),
        notes: row.notes,
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => DispatchLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  toPrimitives(): DispatchPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      orderId: this.orderId.value,
      warehouseId: this.warehouseId.value,
      dispatchDate: this.details.date.value,
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

  // Guardar el borrador solo pisa esta version: si otra persona lo guardo entretanto, se rechaza.
  version(): Date | null {
    return this.loadedVersion;
  }

  currentStatus(): DispatchStatus {
    return this.status;
  }

  date(): SalesDate {
    return this.details.date;
  }

  notes(): string | null {
    return this.details.notes;
  }

  lines(): DispatchLine[] {
    return [...this.details.lines];
  }

  update(details: DispatchDetails, now: Date, today: string): void {
    if (this.status !== 'draft') throw new DispatchNotEditableError(this.id.value, this.status);

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  confirm(now: Date): void {
    if (this.status !== 'draft') throw new DispatchNotConfirmableError(this.id.value, this.status);

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  // `invoiced` lo dice quien bloquea el despacho: si tiene una factura emitida no se anula.
  cancel(invoiced: boolean, now: Date): void {
    if (this.status === 'cancelled') throw new DispatchAlreadyCancelledError(this.id.value);
    if (invoiced) throw new DispatchInvoicedError(this.id.value);

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }
}

function validated(details: DispatchDetails, today: string): DispatchDetails {
  if (details.lines.length === 0) throw new EmptyDispatchError();

  const seen = new Set<string>();

  for (const line of details.lines) {
    if (seen.has(line.orderLineId.value)) throw new DuplicateDispatchLineError(line.orderLineId.value);
    seen.add(line.orderLineId.value);
  }

  details.date.ensureNotAfter(today);

  return { ...details, notes: optionalText(details.notes, NOTES_MAX, 'DispatchNotes') };
}
