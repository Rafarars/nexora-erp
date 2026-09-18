import type { Adjustment, Movement, Stock } from './inventory';
import type { Item, ItemType } from './item';

export interface ItemInput {
  sku: string;
  name: string;
  description: string | null;
  type: ItemType | string;
  categoryId: string | null;
  barcode: string | null;
  isPurchasable: boolean;
  isSellable: boolean;
  salesTaxId: string | null;
  purchaseTaxId: string | null;
  units: { unitId: string; conversionFactor: number; isBase: boolean }[];
}

export interface AdjustmentInput {
  warehouseId: string;
  date: string | null;
  notes: string | null;
  lines: { itemId: string; unitId: string; direction: string; quantity: number; unitCost: number | null }[];
}

export interface InventoryApi {
  searchItems(token: string): Promise<Item[]>;
  saveItem(token: string, id: string | null, input: ItemInput): Promise<void>;
  changeItemStatus(token: string, id: string, active: boolean): Promise<void>;

  searchStock(token: string, warehouseId?: string): Promise<Stock[]>;
  searchMovements(token: string, itemId: string, warehouseId?: string): Promise<Movement[]>;
  searchAdjustments(token: string): Promise<Adjustment[]>;
  saveAdjustment(token: string, id: string | null, input: AdjustmentInput): Promise<void>;
  confirmAdjustment(token: string, id: string): Promise<void>;
  cancelAdjustment(token: string, id: string): Promise<void>;
}
