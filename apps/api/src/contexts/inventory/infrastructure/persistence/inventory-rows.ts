import { Adjustment, AdjustmentType } from '../../domain/adjustment/adjustment.entity.js';
import { InventoryMovement, MovementOriginType } from '../../domain/movement/inventory-movement.entity.js';
import { ItemStock } from '../../domain/stock/item-stock.entity.js';
import { toNumber } from './decimals.js';

type Decimalish = { toNumber(): number };

export interface AdjustmentRow {
  id: string;
  tenantId: string;
  code: string;
  warehouseId: string;
  adjustmentDate: Date;
  type: AdjustmentType;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  createdBy: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  originType?: string | null;
  originId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: {
    id: string;
    lineNumber: number;
    itemId: string;
    itemSku: string;
    itemName: string;
    unitId: string;
    direction: 'in' | 'out';
    quantity: Decimalish;
    baseQuantity: Decimalish;
    unitCost: Decimalish | null;
    revaluationKind?: 'cost' | 'amount' | null;
    amount?: Decimalish | null;
    sourceMovementId?: string | null;
    stockPart?: Decimalish | null;
    soldPart?: Decimalish | null;
  }[];
}

// Traducciones entre filas de Prisma y el dominio, compartidas por los adaptadores.
export function adjustmentFromRow(row: AdjustmentRow): Adjustment {
  return Adjustment.fromPrimitives({
    ...row,
    adjustmentDate: row.adjustmentDate.toISOString().slice(0, 10),
    originType: row.originType ?? null,
    originId: row.originId ?? null,
    lines: row.lines.map((line) => ({
      ...line,
      quantity: toNumber(line.quantity),
      baseQuantity: toNumber(line.baseQuantity),
      unitCost: line.unitCost === null ? null : toNumber(line.unitCost),
      revaluationKind: line.revaluationKind ?? null,
      amount: line.amount === null || line.amount === undefined ? null : toNumber(line.amount),
      sourceMovementId: line.sourceMovementId ?? null,
      stockPart: line.stockPart === null || line.stockPart === undefined ? null : toNumber(line.stockPart),
      soldPart: line.soldPart === null || line.soldPart === undefined ? null : toNumber(line.soldPart),
    })),
  });
}

export function stockFromRow(row: {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  quantity: Decimalish;
  averageCost: Decimalish;
  lastSequence: number;
  updatedAt: Date;
}): ItemStock {
  return ItemStock.fromPrimitives({ ...row, quantity: toNumber(row.quantity), averageCost: toNumber(row.averageCost) });
}

export function movementFromRow(row: {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  sequence: number;
  direction: 'in' | 'out';
  quantity: Decimalish;
  unitCost: Decimalish;
  balanceQuantity: Decimalish;
  balanceAverageCost: Decimalish;
  originType: string;
  originId: string;
  originLineId: string | null;
  originDate: Date;
  reversalOfId: string | null;
  restoresMovementId: string | null;
  occurredAt: Date;
}): InventoryMovement {
  return InventoryMovement.fromPrimitives({
    ...row,
    originType: row.originType as MovementOriginType,
    // La columna es DATE: el dia sin hora ni zona, como lo escribio el documento.
    originDate: row.originDate.toISOString().slice(0, 10),
    quantity: toNumber(row.quantity),
    unitCost: toNumber(row.unitCost),
    balanceQuantity: toNumber(row.balanceQuantity),
    balanceAverageCost: toNumber(row.balanceAverageCost),
  });
}
