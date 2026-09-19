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
  }[];
}

// Traducciones entre filas de Prisma y el dominio, compartidas por los adaptadores.
export function adjustmentFromRow(row: AdjustmentRow): Adjustment {
  return Adjustment.fromPrimitives({
    ...row,
    adjustmentDate: row.adjustmentDate.toISOString().slice(0, 10),
    lines: row.lines.map((line) => ({
      ...line,
      quantity: toNumber(line.quantity),
      baseQuantity: toNumber(line.baseQuantity),
      unitCost: line.unitCost === null ? null : toNumber(line.unitCost),
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
