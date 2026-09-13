import type { Adjustment, Movement, Stock } from './inventory';

export interface AdjustmentInput {
  warehouseId: string;
  date: string | null;
  notes: string | null;
  lines: { itemId: string; unitId: string; direction: string; quantity: number; unitCost: number | null }[];
}

export interface InventoryApi {
  searchStock(token: string, warehouseId?: string): Promise<Stock[]>;
  searchMovements(token: string, itemId: string, warehouseId?: string): Promise<Movement[]>;
  searchAdjustments(token: string): Promise<Adjustment[]>;
  saveAdjustment(token: string, id: string | null, input: AdjustmentInput): Promise<void>;
  confirmAdjustment(token: string, id: string): Promise<void>;
  cancelAdjustment(token: string, id: string): Promise<void>;
}
