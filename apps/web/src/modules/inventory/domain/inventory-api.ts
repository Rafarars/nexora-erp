import type { Adjustment, Movement, Stock } from './inventory';
import type { Item, ItemType } from './item';
import type { LowStockRow } from './inventory';

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
  reorderRules: { warehouseId: string; minQuantity: number; maxQuantity: number | null; reorderQuantity: number }[];
  prices: { priceListId: string; price: number }[];
  minPrice: number | null;
}

export interface AdjustmentInput {
  warehouseId: string;
  date: string | null;
  notes: string | null;
  lines: { itemId: string; unitId: string; direction: string; quantity: number; unitCost: number | null }[];
}

export interface ItemPage {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface InventoryApi {
  // Una pagina del maestro: `q` filtra por codigo, SKU, nombre y codigo de barras.
  searchItems(token: string, page?: { q?: string; limit?: number; offset?: number }): Promise<ItemPage>;
  // Todos los articulos, para llenar un selector: recorre las paginas que haga falta.
  allItems(token: string): Promise<Item[]>;
  searchLowStock(token: string, warehouseId?: string): Promise<LowStockRow[]>;
  saveItem(token: string, id: string | null, input: ItemInput): Promise<void>;
  changeItemStatus(token: string, id: string, active: boolean): Promise<void>;

  searchStock(token: string, warehouseId?: string): Promise<Stock[]>;
  searchMovements(token: string, itemId: string, warehouseId?: string): Promise<Movement[]>;
  searchAdjustments(token: string): Promise<Adjustment[]>;
  saveAdjustment(token: string, id: string | null, input: AdjustmentInput): Promise<void>;
  confirmAdjustment(token: string, id: string): Promise<void>;
  cancelAdjustment(token: string, id: string): Promise<void>;
}
