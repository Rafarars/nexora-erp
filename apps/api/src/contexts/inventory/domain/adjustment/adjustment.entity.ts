import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  AdjustmentAlreadyCancelledError,
  AdjustmentNotConfirmableError,
  AdjustmentNotEditableError,
  EmptyAdjustmentError,
  InventoryTextTooLongError,
} from '../errors/inventory.errors.js';
import { WarehouseRef } from '../shared/references.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { AdjustmentDate } from './adjustment-date.vo.js';
import { AdjustmentLine, AdjustmentLinePrimitives } from './adjustment-line.js';

export class AdjustmentId extends Uuid {
  static of(value: string): AdjustmentId {
    return new AdjustmentId(value);
  }
}

export type AdjustmentStatus = 'draft' | 'confirmed' | 'cancelled';

export interface AdjustmentDetails {
  warehouseId: WarehouseRef;
  date: AdjustmentDate;
  notes: string | null;
  lines: AdjustmentLine[];
}

export interface AdjustmentPrimitives {
  id: string;
  tenantId: string;
  code: string;
  warehouseId: string;
  adjustmentDate: string;
  notes: string | null;
  status: AdjustmentStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: AdjustmentLinePrimitives[];
}

const NOTES_MAX = 500;

// El documento que corrige existencias. Su ciclo es corto y no tiene vuelta atras:
// borrador (editable, no mueve nada) → confirmado (ya movio existencia) → anulado. Anular un
// confirmado no borra sus movimientos: la contrapartida la escribe AdjustmentCancellation.
export class Adjustment {
  private constructor(
    readonly id: AdjustmentId,
    readonly tenantId: TenantId,
    readonly code: string,
    private details: AdjustmentDetails,
    private status: AdjustmentStatus,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(id: AdjustmentId, tenantId: TenantId, code: string, details: AdjustmentDetails, now: Date, today: string): Adjustment {
    return new Adjustment(id, tenantId, code, validated(details, today), 'draft', null, null, now, now);
  }

  static fromPrimitives(row: AdjustmentPrimitives): Adjustment {
    return new Adjustment(
      AdjustmentId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      {
        warehouseId: WarehouseRef.of(row.warehouseId),
        date: AdjustmentDate.of(row.adjustmentDate),
        notes: row.notes,
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => AdjustmentLine.fromPrimitives(line)),
      },
      row.status,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
      row.updatedAt,
    );
  }

  toPrimitives(): AdjustmentPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      warehouseId: this.details.warehouseId.value,
      adjustmentDate: this.details.date.value,
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

  currentStatus(): AdjustmentStatus {
    return this.status;
  }

  warehouseId(): WarehouseRef {
    return this.details.warehouseId;
  }

  date(): AdjustmentDate {
    return this.details.date;
  }

  lines(): AdjustmentLine[] {
    return [...this.details.lines];
  }

  update(details: AdjustmentDetails, now: Date, today: string): void {
    if (this.status !== 'draft') {
      throw new AdjustmentNotEditableError(this.id.value, this.status);
    }

    this.details = validated(details, today);
    this.updatedAt = now;
  }

  confirm(now: Date): void {
    if (this.status !== 'draft') {
      throw new AdjustmentNotConfirmableError(this.id.value, this.status);
    }

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'cancelled') {
      throw new AdjustmentAlreadyCancelledError(this.id.value);
    }

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }
}

function validated(details: AdjustmentDetails, today: string): AdjustmentDetails {
  if (details.lines.length === 0) {
    throw new EmptyAdjustmentError();
  }

  details.date.ensureNotAfter(today);

  const notes = details.notes?.trim() || null;

  if (notes && notes.length > NOTES_MAX) {
    throw new InventoryTextTooLongError('AdjustmentNotes', NOTES_MAX);
  }

  return { ...details, notes };
}
