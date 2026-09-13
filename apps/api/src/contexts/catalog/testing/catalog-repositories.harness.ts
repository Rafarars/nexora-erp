import { CategoryRepository } from '../domain/category/category.repository.js';
import { ItemRepository } from '../domain/item/item.repository.js';
import { MeasurementUnitRepository } from '../domain/measurement-unit/measurement-unit.repository.js';
import { CodeSequence } from '../domain/shared/code-sequence.js';
import { TaxRepository } from '../domain/tax/tax.repository.js';
import { WarehouseRepository } from '../domain/warehouse/warehouse.repository.js';

export interface CatalogRepositories {
  categories: CategoryRepository;
  units: MeasurementUnitRepository;
  taxes: TaxRepository;
  warehouses: WarehouseRepository;
  items: ItemRepository;
  codes: CodeSequence;
}

// Lo unico que cada implementacion hace distinto: entregar los repositorios y dejar el
// catalogo vacio, con las dos empresas de prueba existiendo.
export interface CatalogRepositoriesHarness {
  repositories(): CatalogRepositories;
  reset(): Promise<void>;
  close(): Promise<void>;
}
