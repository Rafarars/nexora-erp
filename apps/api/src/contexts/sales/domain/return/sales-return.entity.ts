import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { CustomerId } from '../customer/customer.entity.js';
import { DispatchId } from '../dispatch/dispatch.entity.js';
import {
  DuplicateSalesReturnLineError,
  EmptySalesReturnError,
  InvalidReturnConditionError,
  ReturnBeforeDispatchError,
  SalesReturnAlreadyCancelledError,
  SalesReturnNotConfirmableError,
  SalesReturnNotEditableError,
} from '../errors/sales.errors.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { SalesDate } from '../shared/sales-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SalesReturnLine, SalesReturnLinePrimitives } from './sales-return-line.js';

export class SalesReturnId extends Uuid {
  static of(value: string): SalesReturnId {
    return new SalesReturnId(value);
  }
}

export const RETURN_CONDITIONS = ['resalable', 'damaged', 'scrap'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export type SalesReturnStatus = 'draft' | 'confirmed' | 'cancelled';

export interface SalesReturnDetails {
  date: SalesDate;
  condition: ReturnCondition;
  reason: string | null;
  notes: string | null;
  lines: SalesReturnLine[];
}

export interface SalesReturnPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  dispatchId: string | null;
  warehouseId: string;
  returnDate: string;
  condition: ReturnCondition;
  reason: string | null;
  notes: string | null;
  status: SalesReturnStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: SalesReturnLinePrimitives[];
}

const NOTES_MAX = 500;
const REASON_MAX = 100;

export class SalesReturn {
  private constructor(
    readonly id: SalesReturnId,
    readonly tenantId: TenantId,
    readonly code: string,
    readonly customerId: CustomerId,
    readonly dispatchId: DispatchId | null,
    readonly warehouseId: WarehouseRef,
    private details: SalesReturnDetails,
    private readonly currencyDoc: DocumentCurrency,
    private status: SalesReturnStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: SalesReturnId,
    tenantId: TenantId,
    code: string,
    customer: { id: CustomerId },
    dispatch: { id: DispatchId; warehouseId: WarehouseRef; date: SalesDate } | null,
    warehouseId: WarehouseRef,
    currency: DocumentCurrency,
    details: SalesReturnDetails,
    now: Date,
    today: string,
  ): SalesReturn {
    const targetWarehouse = dispatch ? dispatch.warehouseId : warehouseId;
    const validatedDetails = validated(details, today, dispatch?.date ?? null);

    return new SalesReturn(
      id,
      tenantId,
      code,
      customer.id,
      dispatch?.id ?? null,
      targetWarehouse,
      validatedDetails,
      currency,
      'draft',
      null,
      null,
      now,
      now,
    );
  }

  static fromPrimitives(row: SalesReturnPrimitives): SalesReturn {
    return new SalesReturn(
      SalesReturnId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      CustomerId.of(row.customerId),
      row.dispatchId ? DispatchId.of(row.dispatchId) : null,
      WarehouseRef.of(row.warehouseId),
      {
        date: SalesDate.of(row.returnDate),
        condition: row.condition,
        reason: row.reason,
        notes: row.notes,
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => SalesReturnLine.fromPrimitives(line)),
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

  toPrimitives(): SalesReturnPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      customerId: this.customerId.value,
      dispatchId: this.dispatchId?.value ?? null,
      warehouseId: this.warehouseId.value,
      returnDate: this.details.date.value,
      condition: this.details.condition,
      reason: this.details.reason,
      notes: this.details.notes,
      status: this.status,
      confirmedAt: this.confirmedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...this.currencyDoc.toPrimitives(),
      lines: this.details.lines.map((line) => line.toPrimitives()),
    };
  }

  date(): SalesDate {
    return this.details.date;
  }

  condition(): ReturnCondition {
    return this.details.condition;
  }

  currentStatus(): SalesReturnStatus {
    return this.status;
  }

  currency(): DocumentCurrency {
    return this.currencyDoc;
  }

  lines(): readonly SalesReturnLine[] {
    return this.details.lines;
  }

  version(): Date | null {
    return this.loadedVersion;
  }

  update(details: SalesReturnDetails, dispatchDate: SalesDate | null, now: Date, today: string): void {
    if (this.status !== 'draft') {
      throw new SalesReturnNotEditableError(this.id.value, this.status);
    }

    this.details = validated(details, today, dispatchDate);
    this.updatedAt = now;
  }

  confirm(linesWithValuation: { lineId: string; unitCost: number; restoresMovementId: string }[], now: Date): void {
    if (this.status !== 'draft') {
      throw new SalesReturnNotConfirmableError(this.id.value, this.status);
    }

    const valuationMap = new Map(linesWithValuation.map((v) => [v.lineId, v]));
    const updatedLines = this.details.lines.map((line) => {
      const val = valuationMap.get(line.id.value);
      if (val) {
        return line.withValuation(val.unitCost, val.restoresMovementId);
      }
      return line;
    });

    this.details = { ...this.details, lines: updatedLines };
    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'cancelled') {
      throw new SalesReturnAlreadyCancelledError(this.id.value);
    }

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }
}

function validated(details: SalesReturnDetails, today: string, dispatchDate: SalesDate | null): SalesReturnDetails {
  if (details.lines.length === 0) {
    throw new EmptySalesReturnError();
  }

  if (!RETURN_CONDITIONS.includes(details.condition)) {
    throw new InvalidReturnConditionError(details.condition);
  }

  details.date.ensureNotAfter(today);

  if (dispatchDate && details.date.isBefore(dispatchDate)) {
    throw new ReturnBeforeDispatchError(details.date.value, dispatchDate.value);
  }

  const seen = new Set<string>();
  for (const line of details.lines) {
    if (line.dispatchLineId) {
      if (seen.has(line.dispatchLineId)) {
        throw new DuplicateSalesReturnLineError(line.dispatchLineId);
      }
      seen.add(line.dispatchLineId);
    }
  }

  return {
    date: details.date,
    condition: details.condition,
    reason: optionalText(details.reason, REASON_MAX, 'SalesReturnReason'),
    notes: optionalText(details.notes, NOTES_MAX, 'SalesReturnNotes'),
    lines: [...details.lines].sort((a, b) => a.lineNumber - b.lineNumber),
  };
}
