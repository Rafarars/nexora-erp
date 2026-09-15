import { CatalogRepositories, CatalogRepositoriesHarness, ItemCommitmentsSeeder } from '../../testing/catalog-repositories.harness.js';
import { InMemoryCategoryRepository } from './in-memory-category.repository.js';
import { InMemoryCodeSequence } from './in-memory-code-sequence.js';
import { InMemoryItemPosting } from './in-memory-item-posting.js';
import { InMemoryItemRepository } from './in-memory-item.repository.js';
import { InMemoryMeasurementUnitRepository } from './in-memory-measurement-unit.repository.js';
import { InMemoryTaxRepository } from './in-memory-tax.repository.js';
import { InMemoryWarehouseRepository } from './in-memory-warehouse.repository.js';

export class InMemoryCatalogRepositoriesHarness implements CatalogRepositoriesHarness {
  private current = this.build();

  repositories(): CatalogRepositories {
    return this.current;
  }

  // Aplica la misma regla que la consulta de la base, que es lo que el contrato comprueba: una
  // linea compromete su unidad si su documento esta confirmado o a medias y le queda pendiente.
  commitments(): ItemCommitmentsSeeder {
    const posting = () => this.current.itemPosting;
    const open = (itemId: string, unitId: string) =>
      posting().openDocumentUnits.set(itemId, [...(posting().openDocumentUnits.get(itemId) ?? []), unitId]);

    return {
      stock: async (itemId, quantity) => {
        if (quantity > 0) posting().itemsWithStock.add(itemId);
      },
      movement: async (itemId) => {
        posting().itemsWithMovements.add(itemId);
      },
      purchaseLine: async ({ itemId, unitId, status, quantity, received }) => {
        if ((status === 'confirmed' || status === 'partially_received') && quantity > received) open(itemId, unitId);
      },
      salesLine: async ({ itemId, unitId, status, quantity, dispatched }) => {
        if ((status === 'confirmed' || status === 'partially_dispatched') && quantity > dispatched) open(itemId, unitId);
      },
    };
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): CatalogRepositories & { itemPosting: InMemoryItemPosting } {
    const items = new InMemoryItemRepository();

    return {
      categories: new InMemoryCategoryRepository(),
      units: new InMemoryMeasurementUnitRepository(),
      taxes: new InMemoryTaxRepository(),
      warehouses: new InMemoryWarehouseRepository(),
      items,
      itemPosting: new InMemoryItemPosting(items),
      codes: new InMemoryCodeSequence(),
    };
  }
}
