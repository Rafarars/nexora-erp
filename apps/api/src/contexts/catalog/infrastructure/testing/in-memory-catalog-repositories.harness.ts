import { CatalogRepositories, CatalogRepositoriesHarness, ItemSeeder } from '../../testing/catalog-repositories.harness.js';
import { InMemoryCategoryRepository } from './in-memory-category.repository.js';
import { InMemoryCodeSequence } from './in-memory-code-sequence.js';
import { InMemoryItemUsage } from './in-memory-item-usage.js';
import { InMemoryMeasurementUnitRepository } from './in-memory-measurement-unit.repository.js';
import { InMemoryPriceListCurrencies } from './in-memory-price-list-currencies.js';
import { InMemoryPriceListRepository } from './in-memory-price-list.repository.js';
import { InMemoryTaxRepository } from './in-memory-tax.repository.js';
import { InMemoryWarehouseRepository } from './in-memory-warehouse.repository.js';

export class InMemoryCatalogRepositoriesHarness implements CatalogRepositoriesHarness {
  private currencyRows = [
    { code: 'USD', isActive: true },
    { code: 'EUR', isActive: true },
    { code: 'VES', isActive: true },
  ];
  private current = this.build();

  async deactivateCurrency(code: string): Promise<() => Promise<void>> {
    const found = this.currencyRows.find((candidate) => candidate.code === code)!;
    found.isActive = false;

    return async () => {
      found.isActive = true;
    };
  }

  repositories(): CatalogRepositories {
    return this.current;
  }

  items(): ItemSeeder {
    return { add: async (item) => this.current.itemUsage.add(item) };
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): CatalogRepositories & { itemUsage: InMemoryItemUsage } {
    return {
      categories: new InMemoryCategoryRepository(),
      units: new InMemoryMeasurementUnitRepository(),
      taxes: new InMemoryTaxRepository(),
      warehouses: new InMemoryWarehouseRepository(),
      priceLists: new InMemoryPriceListRepository(),
      currencies: new InMemoryPriceListCurrencies(this.currencyRows),
      itemUsage: new InMemoryItemUsage(),
      codes: new InMemoryCodeSequence(),
    };
  }
}
