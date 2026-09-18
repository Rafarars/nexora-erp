export type AdjustmentStatus = 'draft' | 'confirmed' | 'cancelled';
export type Direction = 'in' | 'out';
export type MovementOriginType = 'adjustment' | 'receipt' | 'dispatch';

export interface Stock {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  averageCost: number;
  totalValue: number;
}

// Lo que hay que reponer en una bodega: cuanto hay, cuanto se quiere y cuanto pedir.
export interface LowStockRow {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  missing: number;
  suggested: number;
}

export interface Movement {
  id: string;
  warehouse: { id: string; name: string };
  sequence: number;
  direction: Direction;
  quantity: number;
  unitCost: number;
  balanceQuantity: number;
  balanceAverageCost: number;
  origin: { type: MovementOriginType; id: string; code: string };
  isReversal: boolean;
  occurredAt: string;
}

export interface AdjustmentLine {
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  direction: Direction;
  quantity: number;
  baseQuantity: number;
  unitCost: number | null;
}

export interface Adjustment {
  id: string;
  code: string;
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: AdjustmentStatus;
  lines: AdjustmentLine[];
}

export const STATUS_LABELS: Record<AdjustmentStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Anulado',
};

export const DIRECTION_LABELS: Record<Direction, string> = { in: 'Entrada', out: 'Salida' };

// Que documento movio la existencia, como se lee en el kardex.
export const ORIGIN_LABELS: Record<MovementOriginType, string> = { adjustment: 'Ajuste', receipt: 'Entrada de compra', dispatch: 'Despacho' };

// Lo que la interfaz ofrece en cada estado. La API lo vuelve a comprobar; esto solo evita
// ofrecer un boton que acabaria en error.
export function availableActions(adjustment: Pick<Adjustment, 'status'>): { edit: boolean; confirm: boolean; cancel: boolean } {
  return {
    edit: adjustment.status === 'draft',
    confirm: adjustment.status === 'draft',
    cancel: adjustment.status !== 'cancelled',
  };
}

// "2 cja (48 un) · 1 un": como se lee un ajuste de un vistazo.
export function summarizeLines(lines: AdjustmentLine[], baseUnitOf: (itemId: string) => string): string {
  return lines
    .map((line) => {
      const sign = line.direction === 'in' ? '+' : '−';
      const base = line.quantity === line.baseQuantity ? '' : ` (${formatQuantity(line.baseQuantity)} ${baseUnitOf(line.itemId)})`;

      return `${sign}${formatQuantity(line.quantity)} ${line.unitAbbreviation}${base} ${line.sku}`;
    })
    .join(' · ');
}

export function formatQuantity(value: number): string {
  return value.toLocaleString('es', { maximumFractionDigits: 4, useGrouping: false });
}

// El costo admite seis decimales: mostrarlo con cuatro en un campo editable lo recortaria
// en silencio al volver a guardar.
export function formatCost(value: number): string {
  return value.toLocaleString('es', { maximumFractionDigits: 6, useGrouping: false });
}

export function formatMoney(value: number): string {
  return value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 6, useGrouping: false });
}
