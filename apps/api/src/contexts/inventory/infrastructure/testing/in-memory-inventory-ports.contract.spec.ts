import { PEOPLE, stockWarehouses, stockableItems } from '../../domain/testing/inventory.mother.js';
import { InMemoryInventoryCatalog } from './in-memory-inventory-catalog.js';
import { InMemoryDocumentAuthors } from './in-memory-document-authors.js';
import { InMemoryInventoryCodeSequence } from './in-memory-inventory-code-sequence.js';
import { InMemoryInventoryStore } from './in-memory-inventory-store.js';
import { describeInventoryPortsContract } from '../../testing/inventory-ports.contract.js';
import { InventoryPorts, InventoryPortsHarness } from '../../testing/inventory-store.harness.js';

class InMemoryInventoryPortsHarness implements InventoryPortsHarness {
  private catalog = new InMemoryInventoryCatalog(stockableItems(), stockWarehouses());
  private current = this.build();

  ports(): InventoryPorts {
    return this.current;
  }

  async deactivateItem(itemId: string): Promise<void> {
    this.catalog.deactivate(itemId);
  }

  async reset(): Promise<void> {
    this.catalog = new InMemoryInventoryCatalog(stockableItems(), stockWarehouses());
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): InventoryPorts {
    const store = new InMemoryInventoryStore(this.catalog);

    return {
      adjustments: store,
      stocks: store,
      posting: store,
      authors: new InMemoryDocumentAuthors(PEOPLE),
      codes: new InMemoryInventoryCodeSequence(),
    };
  }
}

describeInventoryPortsContract('in memory', () => new InMemoryInventoryPortsHarness());
