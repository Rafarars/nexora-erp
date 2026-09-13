import { InMemoryInventoryCodeSequence } from './in-memory-inventory-code-sequence.js';
import { InMemoryInventoryStore } from './in-memory-inventory-store.js';
import { describeInventoryPortsContract } from '../../testing/inventory-ports.contract.js';
import { InventoryPorts, InventoryPortsHarness } from '../../testing/inventory-store.harness.js';

class InMemoryInventoryPortsHarness implements InventoryPortsHarness {
  private current = this.build();

  ports(): InventoryPorts {
    return this.current;
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): InventoryPorts {
    const store = new InMemoryInventoryStore();

    return { adjustments: store, stocks: store, posting: store, codes: new InMemoryInventoryCodeSequence() };
  }
}

describeInventoryPortsContract('in memory', () => new InMemoryInventoryPortsHarness());
