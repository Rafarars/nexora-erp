import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  AdjustmentAlreadyCancelledError,
  AdjustmentNotConfirmableError,
  AdjustmentNotEditableError,
  EmptyAdjustmentError,
  InvalidAdjustmentTypeError,
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

// Por que se corrige la existencia. La revaluacion es el unico que no mueve cantidad:
// reexpresa el costo de lo que ya esta en la bodega.
export const ADJUSTMENT_TYPES = [
  'physical_count',
  'loss',
  'damage',
  'expiration',
  'theft',
  'correction',
  'revaluation',
  'other',
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

export function isRevaluation(type: AdjustmentType): boolean {
  return type === 'revaluation';
}

export function adjustmentTypeOf(value: string): AdjustmentType {
  const type = ADJUSTMENT_TYPES.find((candidate) => candidate === value);

  if (!type) throw new InvalidAdjustmentTypeError(value);

  return type;
}

export interface AdjustmentDetails {
  warehouseId: WarehouseRef;
  date: AdjustmentDate;
  type: AdjustmentType;
  notes: string | null;
  lines: AdjustmentLine[];
}

export interface AdjustmentPrimitives {
  id: string;
  tenantId: string;
  code: string;
  warehouseId: string;
  adjustmentDate: string;
  type: AdjustmentType;
  notes: string | null;
  status: AdjustmentStatus;
  createdBy: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
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
    // Quien lo registro y quien lo cerro. Un ajuste mueve existencia sin una operacion
    // comercial detras: sin esto no queda constancia de quien lo hizo.
    private readonly createdBy: string | null,
    private confirmedAt: Date | null,
    private confirmedBy: string | null,
    private cancelledAt: Date | null,
    private cancelledBy: string | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
    // El updatedAt con que se leyo; null si nunca se guardo.
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: AdjustmentId,
    tenantId: TenantId,
    code: string,
    details: AdjustmentDetails,
    now: Date,
    today: string,
    createdBy: string | null = null,
  ): Adjustment {
    return new Adjustment(id, tenantId, code, validated(details, today), 'draft', createdBy, null, null, null, null, now, now);
  }

  static fromPrimitives(row: AdjustmentPrimitives): Adjustment {
    return new Adjustment(
      AdjustmentId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      {
        warehouseId: WarehouseRef.of(row.warehouseId),
        date: AdjustmentDate.of(row.adjustmentDate),
        type: row.type,
        notes: row.notes,
        lines: [...row.lines].sort((a, b) => a.lineNumber - b.lineNumber).map((line) => AdjustmentLine.fromPrimitives(line)),
      },
      row.status,
      row.createdBy,
      row.confirmedAt,
      row.confirmedBy,
      row.cancelledAt,
      row.cancelledBy,
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
      type: this.details.type,
      notes: this.details.notes,
      status: this.status,
      createdBy: this.createdBy,
      confirmedAt: this.confirmedAt,
      confirmedBy: this.confirmedBy,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
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

  type(): AdjustmentType {
    return this.details.type;
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

  confirm(now: Date, userId: string | null = null): void {
    if (this.status !== 'draft') {
      throw new AdjustmentNotConfirmableError(this.id.value, this.status);
    }

    this.status = 'confirmed';
    this.confirmedAt = now;
    this.confirmedBy = userId;
    this.updatedAt = now;
  }

  cancel(now: Date, userId: string | null = null): void {
    if (this.status === 'cancelled') {
      throw new AdjustmentAlreadyCancelledError(this.id.value);
    }

    this.status = 'cancelled';
    this.cancelledAt = now;
    this.cancelledBy = userId;
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
