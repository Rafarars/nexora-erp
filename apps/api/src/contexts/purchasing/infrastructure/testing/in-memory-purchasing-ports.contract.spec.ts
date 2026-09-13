import { describePurchasingPortsContract } from '../../testing/purchasing-ports.contract.js';
import { PurchasingPorts, PurchasingPortsHarness } from '../../testing/purchasing-ports.harness.js';
import { InMemoryPurchasingCodeSequence } from './in-memory-purchasing-code-sequence.js';
import { InMemoryPurchasingStore } from './in-memory-purchasing-store.js';
import { InMemorySupplierRepository } from './in-memory-supplier.repository.js';
import { TENANT_A } from '../../domain/testing/purchasing.mother.js';

class InMemoryPurchasingPortsHarness implements PurchasingPortsHarness {
  private store = new InMemoryPurchasingStore();
  private current = this.build();

  ports(): PurchasingPorts {
    return this.current;
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    return this.store.stockOf(TENANT_A, itemId, warehouseId);
  }

  async withdraw(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    this.store.withdraw(TENANT_A, itemId, warehouseId, quantity);
  }

  async reset(): Promise<void> {
    this.store = new InMemoryPurchasingStore();
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): PurchasingPorts {
    return {
      suppliers: new InMemorySupplierRepository(),
      orders: this.store.orders,
      receipts: this.store.receipts,
      orderPosting: this.store.orderPosting,
      receiptPosting: this.store.receiptPosting,
      codes: new InMemoryPurchasingCodeSequence(),
    };
  }
}

describePurchasingPortsContract('in memory', () => new InMemoryPurchasingPortsHarness());
