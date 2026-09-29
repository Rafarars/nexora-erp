import { PayableInvoicePrimitives } from '../../domain/ledger/payable-invoice.js';
import { PayableSupplier } from '../../domain/ledger/payables-ledger.js';
import { PayablesPorts, PayablesPortsHarness } from '../../testing/payables-ports.harness.js';
import { InMemoryPayablesCodeSequence } from './in-memory-payables-code-sequence.js';
import { InMemoryPayablesStore } from './in-memory-payables-store.js';

export class InMemoryPayablesPortsHarness implements PayablesPortsHarness {
  private store = new InMemoryPayablesStore();
  private codeSequence = new InMemoryPayablesCodeSequence();

  ports(): PayablesPorts {
    return {
      payments: this.store.payments,
      posting: this.store.posting,
      ledger: this.store.ledger,
      codes: this.codeSequence,
    };
  }

  async supplier(tenantId: string, supplier: PayableSupplier): Promise<void> {
    this.store.supplier(tenantId, supplier);
  }

  async invoice(tenantId: string, invoice: Omit<PayableInvoicePrimitives, 'paid'>): Promise<void> {
    this.store.invoice(tenantId, invoice);
  }

  async cancelInvoice(_tenantId: string, invoiceId: string): Promise<void> {
    this.store.cancelInvoice(invoiceId);
  }

  async setAmountDecimals(tenantId: string, decimals: number): Promise<void> {
    this.store.setAmountDecimals(tenantId, decimals);
  }

  async reset(): Promise<void> {
    this.store = new InMemoryPayablesStore();
    this.codeSequence = new InMemoryPayablesCodeSequence();
  }

  async close(): Promise<void> {}
}
