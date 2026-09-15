import { TENANT_A, salesWarehouses, sellableItems } from '../../domain/testing/sales.mother.js';
import { describeSalesPortsContract } from '../../testing/sales-ports.contract.js';
import { SalesPorts, SalesPortsHarness } from '../../testing/sales-ports.harness.js';
import { InMemoryCustomerRepository } from './in-memory-customer.repository.js';
import { InMemorySalesCatalog } from './in-memory-sales-catalog.js';
import { InMemorySalesCodeSequence } from './in-memory-sales-code-sequence.js';
import { InMemorySalesStore } from './in-memory-sales-store.js';

class InMemorySalesPortsHarness implements SalesPortsHarness {
  private customers = new InMemoryCustomerRepository();
  private store = new InMemorySalesStore(this.customers, new InMemorySalesCatalog(sellableItems(), salesWarehouses()));
  private current = this.build();

  ports(): SalesPorts {
    return this.current;
  }

  async stock(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    this.store.stock(TENANT_A, itemId, warehouseId, quantity);
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    return this.store.stockOf(TENANT_A, itemId, warehouseId);
  }

  async pay(invoiceId: string, _customerId: string, amount: number): Promise<void> {
    this.store.pay(invoiceId, amount);
  }

  async reset(): Promise<void> {
    this.customers = new InMemoryCustomerRepository();
    this.store = new InMemorySalesStore(this.customers, new InMemorySalesCatalog(sellableItems(), salesWarehouses()));
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): SalesPorts {
    return {
      customers: this.customers,
      orders: this.store.orders,
      dispatches: this.store.dispatches,
      invoices: this.store.invoices,
      orderPosting: this.store.orderPosting,
      dispatchPosting: this.store.dispatchPosting,
      invoicePosting: this.store.invoicePosting,
      codes: new InMemorySalesCodeSequence(),
    };
  }
}

describeSalesPortsContract('in memory', () => new InMemorySalesPortsHarness());
