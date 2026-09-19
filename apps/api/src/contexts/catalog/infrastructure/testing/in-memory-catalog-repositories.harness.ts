import { CatalogRepositories, CatalogRepositoriesHarness, ItemSeeder, WarehouseSeeder } from '../../testing/catalog-repositories.harness.js';
import { TENANT_A } from '../../domain/testing/catalog.mother.js';
import { InMemoryCategoryRepository } from './in-memory-category.repository.js';
import { InMemoryCodeSequence } from './in-memory-code-sequence.js';
import { InMemoryItemUsage } from './in-memory-item-usage.js';
import { InMemoryMeasurementUnitRepository } from './in-memory-measurement-unit.repository.js';
import { InMemoryPriceListCurrencies } from './in-memory-price-list-currencies.js';
import { InMemoryPriceListRepository } from './in-memory-price-list.repository.js';
import { InMemoryStockUsage } from './in-memory-stock-usage.js';
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

  // El doble aplica la misma regla que la consulta de la base: confirmados y a medias cuentan,
  // los demas estados no.
  warehouseUsage(): WarehouseSeeder {
    const stock = () => this.current.stockUsage;
    const open = (warehouseId: string, counts: boolean) => {
      if (counts) stock().addOpenDocument(TENANT_A, warehouseId);
    };

    return {
      stock: async (warehouseId, quantity) => {
        if (quantity > 0) stock().addStock(TENANT_A, warehouseId);
      },
      purchaseOrder: async (warehouseId, status) => open(warehouseId, status === 'confirmed' || status === 'partially_received'),
      salesOrder: async (warehouseId, status) => open(warehouseId, status === 'confirmed' || status === 'partially_dispatched'),
    };
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): CatalogRepositories & { itemUsage: InMemoryItemUsage; stockUsage: InMemoryStockUsage } {
    return {
      categories: new InMemoryCategoryRepository(),
      units: new InMemoryMeasurementUnitRepository(),
      taxes: new InMemoryTaxRepository(),
      warehouses: new InMemoryWarehouseRepository(),
      priceLists: new InMemoryPriceListRepository(),
      currencies: new InMemoryPriceListCurrencies(this.currencyRows),
      itemUsage: new InMemoryItemUsage(),
      stockUsage: new InMemoryStockUsage(),
      codes: new InMemoryCodeSequence(),
    };
  }
}
