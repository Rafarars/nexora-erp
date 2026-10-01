import { describePurchasingPortsContract } from '../../testing/purchasing-ports.contract.js';
import { PurchasingPorts, PurchasingPortsHarness } from '../../testing/purchasing-ports.harness.js';
import { InMemoryPurchasingCodeSequence } from './in-memory-purchasing-code-sequence.js';
import { InMemoryPurchasingStore } from './in-memory-purchasing-store.js';
import { InMemorySupplierRepository } from './in-memory-supplier.repository.js';
import { TENANT_A, purchasableItems, purchaseWarehouses } from '../../domain/testing/purchasing.mother.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryPurchasingCatalog } from './in-memory-purchasing-catalog.js';

import { InMemoryPurchaseInvoiceRepository } from './in-memory-purchase-invoice.repository.js';
import { InMemoryPurchaseInvoicePosting } from './in-memory-purchase-invoice-posting.js';
import { InMemoryInvoiceRevaluationPosting } from './in-memory-invoice-revaluation-posting.js';

class InMemoryPurchasingPortsHarness implements PurchasingPortsHarness {
  private store = new InMemoryPurchasingStore(new InMemoryPurchasingCatalog(purchasableItems(), purchaseWarehouses()));
  private invoiceRepo = new InMemoryPurchaseInvoiceRepository();
  private revaluationPosting = new InMemoryInvoiceRevaluationPosting();
  private current = this.build();

  ports(): PurchasingPorts {
    return this.current;
  }

  async stockOf(itemId: string, warehouseId: string): Promise<number> {
    return this.store.stockOf(TENANT_A, itemId, warehouseId);
  }

  async averageCostOf(itemId: string, warehouseId: string): Promise<number> {
    return this.store.averageCostOf(TENANT_A, itemId, warehouseId);
  }

  async withdraw(itemId: string, warehouseId: string, quantity: number): Promise<void> {
    this.store.withdraw(TENANT_A, itemId, warehouseId, quantity);
  }

  async attachConfirmedCreditNote(invoiceId: string, _amount: number): Promise<void> {
    (this.current.invoicePosting as InMemoryPurchaseInvoicePosting).registerCreditNote(invoiceId);
  }

  async adjustmentsOf(tenantId: string, invoiceId: string) {
    return this.revaluationPosting.adjustments
      .filter((a) => a.tenantId === tenantId && a.originType === 'purchase_invoice' && a.originId === invoiceId)
      .map((r) => ({
        id: r.id,
        code: r.code,
        status: r.status,
        type: r.type,
        lines: r.lines.map((l) => ({ itemId: l.itemId, amount: l.amount, direction: l.direction })),
      }));
  }

  async reset(): Promise<void> {
    this.store = new InMemoryPurchasingStore(new InMemoryPurchasingCatalog(purchasableItems(), purchaseWarehouses()));
    this.invoiceRepo = new InMemoryPurchaseInvoiceRepository();
    this.revaluationPosting = new InMemoryInvoiceRevaluationPosting();
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): PurchasingPorts {
    this.store.setConfirmedInvoicesChecker(async (receiptLineIds) => {
      const quantities = await this.invoiceRepo.invoicedQuantitiesByReceiptLine(TenantId.of(TENANT_A), receiptLineIds);
      return Array.from(quantities.values()).some((q) => q > 0);
    });

    return {
      suppliers: new InMemorySupplierRepository(),
      orders: this.store.orders,
      receipts: this.store.receipts,
      returns: this.store.returns,
      invoices: this.invoiceRepo,
      orderPosting: this.store.orderPosting,
      receiptPosting: this.store.receiptPosting,
      returnPosting: this.store.returnPosting,
      invoicePosting: new InMemoryPurchaseInvoicePosting(
        this.invoiceRepo,
        this.store.receipts,
        this.store.orders,
        this.store.returns,
        (order) => this.store.updateConfirmedOrder(order),
        this.revaluationPosting,
      ),
      revaluations: this.revaluationPosting,
      codes: new InMemoryPurchasingCodeSequence(),
    };
  }
}

describePurchasingPortsContract('in memory', () => new InMemoryPurchasingPortsHarness());
