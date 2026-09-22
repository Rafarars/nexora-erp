import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { GoodsReceiptId } from '../receipt/goods-receipt.entity.js';
import {
  DuplicatePurchaseReturnLineError,
  EmptyPurchaseReturnError,
  PurchaseReturnAlreadyCancelledError,
  PurchaseReturnNotConfirmableError,
  PurchaseReturnNotEditableError,
  ReturnBeforeReceiptError,
} from '../errors/purchasing.errors.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { PurchaseReturnLine, PurchaseReturnLinePrimitives } from './purchase-return-line.js';

export class PurchaseReturnId extends Uuid {
  static of(value: string): PurchaseReturnId {
    return new PurchaseReturnId(value);
  }
}

export type PurchaseReturnStatus = 'draft' | 'confirmed' | 'cancelled';

export interface PurchaseReturnDetails {
  date: PurchaseDate;
  reason: string | null;
  notes: string | null;
  lines: PurchaseReturnLine[];
}

export interface PurchaseReturnPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  receiptId: string;
  warehouseId: string;
  returnDate: string;
  reason: string | null;
  notes: string | null;
  status: PurchaseReturnStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: PurchaseReturnLinePrimitives[];
}

const NOTES_MAX = 500;
const REASON_MAX = 100;

export class PurchaseReturn {
  private constructor(
    readonly id: PurchaseReturnId,
    readonly tenantId: TenantId,
    readonly code: string,
    readonly supplierId: SupplierId,
    readonly receiptId: GoodsReceiptId,
    readonly warehouseId: WarehouseRef,
    private details: PurchaseReturnDetails,
    private readonly currencyDoc: DocumentCurrency,
    private status: PurchaseReturnStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: PurchaseReturnId,
    tenantId: TenantId,
    code: string,
    supplier: { id: SupplierId },
    receipt: { id: GoodsReceiptId; warehouseId: WarehouseRef; date: PurchaseDate },
    currency: DocumentCurrency,
    details: PurchaseReturnDetails,
    now: Date,
    today: string,
  ): PurchaseReturn {
    const validatedDetails = validated(details, today, receipt.date);

    return new PurchaseReturn(
      id,
      tenantId,
      code,
      supplier.id,
      receipt.id,
      receipt.warehouseId,
      validatedDetails,
      currency,
      'draft',
      null,
      null,
      now,
      now,
    );
  }

  static fromPrimitives(row: PurchaseReturnPrimitives): PurchaseReturn {
    return new PurchaseReturn(
      PurchaseReturnId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      SupplierId.of(row.supplierId),
      GoodsReceiptId.of(row.receiptId),
      WarehouseRef.of(row.warehouseId),
      {
        date: PurchaseDate.of(row.returnDate),
        reason: row.reason,
        notes: row.notes,
        lines: row.lines.map((l) => PurchaseReturnLine.fromPrimitives(l)),
      },
      DocumentCurrency.fromPrimitives(row),
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  currentStatus(): PurchaseReturnStatus {
    return this.status;
  }

  returnDate(): PurchaseDate {
    return this.details.date;
  }

  reason(): string | null {
    return this.details.reason;
  }

  notes(): string | null {
    return this.details.notes;
  }

  currency(): DocumentCurrency {
    return this.currencyDoc;
  }

  lines(): PurchaseReturnLine[] {
    return [...this.details.lines];
  }

  version(): Date | null {
    return this.loadedVersion;
  }

  rewrite(
    details: PurchaseReturnDetails,
    receiptDate: PurchaseDate,
    now: Date,
    today: string,
  ): void {
    if (this.status !== 'draft') {
      throw new PurchaseReturnNotEditableError(this.id.value, this.status);
    }

    this.details = validated(details, today, receiptDate);
    this.updatedAt = now;
  }

  confirm(now: Date, restoresMovements: Map<string, string>): void {
    if (this.status !== 'draft') {
      throw new PurchaseReturnNotConfirmableError(this.id.value, this.status);
    }

    for (const line of this.details.lines) {
      const movementId = restoresMovements.get(line.id.value);
      if (movementId) {
        line.assignRestoresMovement(movementId);
      }
    }

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'cancelled') {
      throw new PurchaseReturnAlreadyCancelledError(this.id.value);
    }

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }

  toPrimitives(): PurchaseReturnPrimitives {
    return {
      ...this.currencyDoc.toPrimitives(),
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      supplierId: this.supplierId.value,
      receiptId: this.receiptId.value,
      warehouseId: this.warehouseId.value,
      returnDate: this.details.date.value,
      reason: this.details.reason,
      notes: this.details.notes,
      status: this.status,
      confirmedAt: this.confirmedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lines: this.details.lines.map((l) => l.toPrimitives()),
    };
  }
}

function validated(
  details: PurchaseReturnDetails,
  today: string,
  receiptDate: PurchaseDate,
): PurchaseReturnDetails {
  details.date.ensureNotAfter(today);

  if (details.date.value < receiptDate.value) {
    throw new ReturnBeforeReceiptError('', details.date.value, receiptDate.value);
  }

  if (details.lines.length === 0) {
    throw new EmptyPurchaseReturnError();
  }

  const seen = new Set<string>();
  for (const line of details.lines) {
    if (seen.has(line.receiptLineId)) {
      throw new DuplicatePurchaseReturnLineError(line.receiptLineId);
    }
    seen.add(line.receiptLineId);
  }

  return {
    date: details.date,
    reason: optionalText(details.reason, REASON_MAX, 'Reason'),
    notes: optionalText(details.notes, NOTES_MAX, 'Notes'),
    lines: details.lines,
  };
}
