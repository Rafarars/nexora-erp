import { ReceivableInvoicePrimitives } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer } from '../../domain/ledger/receivables-ledger.js';
import { describeReceivablesPortsContract } from '../../testing/receivables-ports.contract.js';
import { ReceivablesPorts, ReceivablesPortsHarness } from '../../testing/receivables-ports.harness.js';
import { InMemoryReceivablesCodeSequence } from './in-memory-receivables-code-sequence.js';
import { InMemoryReceivablesStore } from './in-memory-receivables-store.js';

class InMemoryReceivablesPortsHarness implements ReceivablesPortsHarness {
  private store = new InMemoryReceivablesStore();
  private current = this.build();

  ports(): ReceivablesPorts {
    return this.current;
  }

  async customer(tenantId: string, customer: ReceivableCustomer): Promise<void> {
    this.store.customer(tenantId, customer);
  }

  async invoice(tenantId: string, invoice: Omit<ReceivableInvoicePrimitives, 'paid'>): Promise<void> {
    this.store.invoice(tenantId, invoice);
  }

  async cancelInvoice(_tenantId: string, invoiceId: string): Promise<void> {
    this.store.cancelInvoice(invoiceId);
  }

  async reset(): Promise<void> {
    this.store = new InMemoryReceivablesStore();
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): ReceivablesPorts {
    return { payments: this.store.payments, posting: this.store.posting, ledger: this.store.ledger, codes: new InMemoryReceivablesCodeSequence() };
  }
}

describeReceivablesPortsContract('in memory', () => new InMemoryReceivablesPortsHarness());
