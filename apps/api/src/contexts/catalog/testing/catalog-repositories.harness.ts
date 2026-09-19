import { CategoryRepository } from '../domain/category/category.repository.js';
import { MeasurementUnitRepository } from '../domain/measurement-unit/measurement-unit.repository.js';
import { PriceListCurrencies } from '../domain/price-list/price-list-currencies.js';
import { PriceListRepository } from '../domain/price-list/price-list.repository.js';
import { CodeSequence } from '../domain/shared/code-sequence.js';
import { TaxRepository } from '../domain/tax/tax.repository.js';
import { StockUsage } from '../domain/stock/stock-usage.js';
import { ItemUsage } from '../domain/usage/item-usage.js';
import { WarehouseRepository } from '../domain/warehouse/warehouse.repository.js';

export interface CatalogRepositories {
  categories: CategoryRepository;
  units: MeasurementUnitRepository;
  taxes: TaxRepository;
  warehouses: WarehouseRepository;
  priceLists: PriceListRepository;
  currencies: PriceListCurrencies;
  itemUsage: ItemUsage;
  stockUsage: StockUsage;
  codes: CodeSequence;
}

// Un articulo activo o no, con lo que usa del catalogo, sembrado en la empresa A. Los articulos
// viven en el inventario: la base los escribe en sus tablas y el doble solo los declara.
export interface ItemSeeder {
  add(item: { categoryId?: string | null; salesTaxId?: string | null; purchaseTaxId?: string | null; unitIds?: string[]; isActive?: boolean }): Promise<void>;
}

// Lo que el inventario y los documentos dicen de una bodega, sembrado en la empresa A: si guarda
// existencia y si alguna orden o pedido cuenta con ella.
export interface WarehouseSeeder {
  stock(warehouseId: string, quantity: number): Promise<void>;
  purchaseOrder(warehouseId: string, status: 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled'): Promise<void>;
  salesOrder(warehouseId: string, status: 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled'): Promise<void>;
}

// Lo unico que cada implementacion hace distinto: entregar los repositorios, sembrar articulos y
// dejar el catalogo vacio, con las dos empresas de prueba existiendo.
export interface CatalogRepositoriesHarness {
  repositories(): CatalogRepositories;
  // Apaga una moneda del catalogo global y devuelve como restaurarla: es una tabla compartida.
  deactivateCurrency(code: string): Promise<() => Promise<void>>;
  items(): ItemSeeder;
  warehouseUsage(): WarehouseSeeder;
  reset(): Promise<void>;
  close(): Promise<void>;
}
