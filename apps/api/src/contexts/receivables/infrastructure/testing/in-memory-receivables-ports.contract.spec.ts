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

  async salesReturnForInvoice(tenantId: string, invoiceId: string, returnId: string, status: 'confirmed' | 'draft' | 'cancelled' = 'confirmed'): Promise<void> {
    this.store.salesReturnForInvoice(tenantId, invoiceId, returnId, status);
  }

  async salesReturn(tenantId: string, returnId: string, customerId: string, status: 'confirmed' | 'draft' | 'cancelled' = 'confirmed'): Promise<void> {
    this.store.salesReturn(tenantId, returnId, customerId, status);
  }

  async cancelSalesReturn(tenantId: string, returnId: string): Promise<void> {
    await this.store.cancelSalesReturn(tenantId, returnId);
  }

  async reset(): Promise<void> {
    this.store = new InMemoryReceivablesStore();
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): ReceivablesPorts {
    return {
      payments: this.store.payments,
      posting: this.store.posting,
      ledger: this.store.ledger,
      codes: new InMemoryReceivablesCodeSequence(),
      creditNotes: this.store.creditNotes,
      creditNotePosting: this.store.creditNotePosting,
    };
  }
}

describeReceivablesPortsContract('in memory', () => new InMemoryReceivablesPortsHarness());
