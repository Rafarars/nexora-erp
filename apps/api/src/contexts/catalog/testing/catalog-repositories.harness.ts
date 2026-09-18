import { CategoryRepository } from '../domain/category/category.repository.js';
import { MeasurementUnitRepository } from '../domain/measurement-unit/measurement-unit.repository.js';
import { CodeSequence } from '../domain/shared/code-sequence.js';
import { TaxRepository } from '../domain/tax/tax.repository.js';
import { ItemUsage } from '../domain/usage/item-usage.js';
import { WarehouseRepository } from '../domain/warehouse/warehouse.repository.js';

export interface CatalogRepositories {
  categories: CategoryRepository;
  units: MeasurementUnitRepository;
  taxes: TaxRepository;
  warehouses: WarehouseRepository;
  itemUsage: ItemUsage;
  codes: CodeSequence;
}

// Un articulo activo o no, con lo que usa del catalogo, sembrado en la empresa A. Los articulos
// viven en el inventario: la base los escribe en sus tablas y el doble solo los declara.
export interface ItemSeeder {
  add(item: { categoryId?: string | null; salesTaxId?: string | null; purchaseTaxId?: string | null; unitIds?: string[]; isActive?: boolean }): Promise<void>;
}

// Lo unico que cada implementacion hace distinto: entregar los repositorios, sembrar articulos y
// dejar el catalogo vacio, con las dos empresas de prueba existiendo.
export interface CatalogRepositoriesHarness {
  repositories(): CatalogRepositories;
  items(): ItemSeeder;
  reset(): Promise<void>;
  close(): Promise<void>;
}
