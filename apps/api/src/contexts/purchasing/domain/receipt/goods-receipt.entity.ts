import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  DuplicateReceiptLineError,
  EmptyGoodsReceiptError,
  GoodsReceiptAlreadyCancelledError,
  GoodsReceiptNotConfirmableError,
  GoodsReceiptNotEditableError,
} from '../errors/purchasing.errors.js';
import { PurchaseOrderId } from '../order/purchase-order.entity.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../shared/document-currency.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { GoodsReceiptLine, GoodsReceiptLinePrimitives } from './goods-receipt-line.js';

export class GoodsReceiptId extends Uuid {
  static of(value: string): GoodsReceiptId {
    return new GoodsReceiptId(value);
  }
}

export type GoodsReceiptStatus = 'draft' | 'confirmed' | 'cancelled';

export interface GoodsReceiptDetails {
  date: PurchaseDate;
  notes: string | null;
  lines: GoodsReceiptLine[];
  // La moneda de su orden, con las tasas del dia en que llego.
  currency: DocumentCurrency;
}

export interface GoodsReceiptPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  orderId: string;
  warehouseId: string;
  receiptDate: string;
  notes: string | null;
  status: GoodsReceiptStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: GoodsReceiptLinePrimitives[];
}

const NOTES_MAX = 500;

// Lo que llego de una orden. Nace de ella y entra en su bodega; ninguna de las dos cambia.
// borrador (no mueve nada) → confirmada (subio la existencia) → anulada (la revirtio).
export class GoodsReceipt {
  private constructor(
    readonly id: GoodsReceiptId,
    readonly tenantId: TenantId,
    readonly code: string,
    readonly orderId: PurchaseOrderId,
    readonly warehouseId: WarehouseRef,
    private details: GoodsReceiptDetails,
    private status: GoodsReceiptStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: GoodsReceiptId,
    tenantId: TenantId,
    code: string,
    order: { id: PurchaseOrderId; warehouseId: WarehouseRef },
    details: GoodsReceiptDetails,
    now: Date,
    today: string,
  ): GoodsReceipt {
    return new GoodsReceipt(id, tenantId, code, order.id, order.warehouseId, validated(details, today), 'draft', null, null, now, now);
  }

  static fromPrimitives(row: GoodsReceiptPrimitives): GoodsReceipt {
    return new GoodsReceipt(
      GoodsReceiptId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      PurchaseOrderId.of(row.orderId),
      WarehouseRef.of(row.warehouseId),
      {
        date: PurchaseDate.of(row.receiptDate),
        notes: row.notes,
        currency: DocumentCurrency.fromPrimitives(row),
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => GoodsReceiptLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  toPrimitives(): GoodsReceiptPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      orderId: this.orderId.value,
      warehouseId: this.warehouseId.value,
      receiptDate: this.details.date.value,
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

  currentStatus(): GoodsReceiptStatus {
    return this.status;
  }

  date(): PurchaseDate {
    return this.details.date;
  }

  notes(): string | null {
    return this.details.notes;
  }

  currency(): DocumentCurrency {
    return this.details.currency;
  }

  lines(): GoodsReceiptLine[] {
    return [...this.details.lines];
  }

  update(details: GoodsReceiptDetails, now: Date, today: string): void {
    if (this.status !== 'draft') throw new GoodsReceiptNotEditableError(this.id.value, this.status);

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  confirm(now: Date): void {
    if (this.status !== 'draft') throw new GoodsReceiptNotConfirmableError(this.id.value, this.status);

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'cancelled') throw new GoodsReceiptAlreadyCancelledError(this.id.value);

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }
}

function validated(details: GoodsReceiptDetails, today: string): GoodsReceiptDetails {
  if (details.lines.length === 0) throw new EmptyGoodsReceiptError();

  const seen = new Set<string>();

  for (const line of details.lines) {
    if (seen.has(line.orderLineId.value)) throw new DuplicateReceiptLineError(line.orderLineId.value);
    seen.add(line.orderLineId.value);
  }

  details.date.ensureNotAfter(today);

  return { ...details, notes: optionalText(details.notes, NOTES_MAX, 'GoodsReceiptNotes') };
}
