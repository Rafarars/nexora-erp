import type { Category, Item, ItemType, MeasurementUnit, Tax, Warehouse } from './catalog';

export interface ItemInput {
  sku: string;
  name: string;
  description: string | null;
  type: ItemType | string;
  categoryId: string | null;
  taxId: string | null;
  units: { unitId: string; conversionFactor: number; isBase: boolean }[];
}

// El puerto del catalogo. Las pantallas no saben de fetch ni de rutas de la API.
export interface CatalogApi {
  searchCategories(token: string): Promise<Category[]>;
  saveCategory(token: string, id: string | null, input: { name: string; description: string | null }): Promise<void>;
  changeCategoryStatus(token: string, id: string, active: boolean): Promise<void>;

  searchUnits(token: string): Promise<MeasurementUnit[]>;
  saveUnit(token: string, id: string | null, input: { name: string; abbreviation: string }): Promise<void>;
  changeUnitStatus(token: string, id: string, active: boolean): Promise<void>;

  searchTaxes(token: string): Promise<Tax[]>;
  saveTax(token: string, id: string | null, input: { name: string; rate: number }): Promise<void>;
  changeTaxStatus(token: string, id: string, active: boolean): Promise<void>;

  searchWarehouses(token: string): Promise<Warehouse[]>;
  saveWarehouse(token: string, id: string | null, input: { name: string; address: string | null }): Promise<void>;
  changeWarehouseStatus(token: string, id: string, active: boolean): Promise<void>;
  setDefaultWarehouse(token: string, id: string): Promise<void>;

  searchItems(token: string): Promise<Item[]>;
  saveItem(token: string, id: string | null, input: ItemInput): Promise<void>;
  changeItemStatus(token: string, id: string, active: boolean): Promise<void>;
}
