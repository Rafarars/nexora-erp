import { CatalogSeeder, ItemCommitmentsSeeder, ItemPorts, ItemPortsHarness } from '../../testing/item-ports.harness.js';
import { InMemoryCatalogReferences } from './in-memory-catalog-references.js';
import { InMemoryItemPosting } from './in-memory-item-posting.js';
import { InMemoryItemRepository } from './in-memory-item.repository.js';

export class InMemoryItemPortsHarness implements ItemPortsHarness {
  private current = this.build();

  ports(): ItemPorts {
    return this.current;
  }

  catalog(): CatalogSeeder {
    const catalog = () => this.current.catalog;

    return {
      category: async (row) => void catalog().categories.push(row),
      tax: async (row) => void catalog().taxes.push(row),
      unit: async (row) => void catalog().units.push(row),
    };
  }

  // Aplica la misma regla que la consulta de la base, que es lo que el contrato comprueba: una
  // linea compromete su unidad si su documento esta confirmado o a medias y le queda pendiente.
  commitments(): ItemCommitmentsSeeder {
    const posting = () => this.current.posting;
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

  private build(): ItemPorts & { posting: InMemoryItemPosting; catalog: InMemoryCatalogReferences } {
    const items = new InMemoryItemRepository();

    return { items, posting: new InMemoryItemPosting(items), catalog: new InMemoryCatalogReferences() };
  }
}
