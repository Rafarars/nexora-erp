import { CatalogRepositories, CatalogRepositoriesHarness } from '../../testing/catalog-repositories.harness.js';
import { InMemoryCategoryRepository } from './in-memory-category.repository.js';
import { InMemoryCodeSequence } from './in-memory-code-sequence.js';
import { InMemoryItemRepository } from './in-memory-item.repository.js';
import { InMemoryMeasurementUnitRepository } from './in-memory-measurement-unit.repository.js';
import { InMemoryTaxRepository } from './in-memory-tax.repository.js';
import { InMemoryWarehouseRepository } from './in-memory-warehouse.repository.js';

export class InMemoryCatalogRepositoriesHarness implements CatalogRepositoriesHarness {
  private current = this.build();

  repositories(): CatalogRepositories {
    return this.current;
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): CatalogRepositories {
    return {
      categories: new InMemoryCategoryRepository(),
      units: new InMemoryMeasurementUnitRepository(),
      taxes: new InMemoryTaxRepository(),
      warehouses: new InMemoryWarehouseRepository(),
      items: new InMemoryItemRepository(),
      codes: new InMemoryCodeSequence(),
    };
  }
}
