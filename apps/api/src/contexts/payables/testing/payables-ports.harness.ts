import { PayableInvoicePrimitives } from '../domain/ledger/payable-invoice.js';
import { PayableSupplier, PayablesLedger } from '../domain/ledger/payables-ledger.js';
import { SupplierPaymentRepository } from '../domain/payment/payment.repository.js';
import { SupplierPaymentPosting } from '../domain/payment/posting/supplier-payment-posting.js';
import { PayablesCodeSequence } from '../domain/shared/code-sequence.js';
import { SupplierCreditNoteRepository } from '../domain/credit-note/supplier-credit-note.repository.js';
import { SupplierCreditNotePosting } from '../domain/credit-note/posting/supplier-credit-note-posting.js';

export interface PayablesPorts {
  payments: SupplierPaymentRepository;
  posting: SupplierPaymentPosting;
  ledger: PayablesLedger;
  codes: PayablesCodeSequence;
  creditNotes: SupplierCreditNoteRepository;
  creditNotePosting: SupplierCreditNotePosting;
}

export interface PayablesPortsHarness {
  ports(): PayablesPorts;
  supplier(tenantId: string, supplier: PayableSupplier): Promise<void>;
  invoice(tenantId: string, invoice: Omit<PayableInvoicePrimitives, 'paid'>): Promise<void>;
  cancelInvoice(tenantId: string, invoiceId: string): Promise<void>;
  purchaseReturn?(tenantId: string, returnId: string, supplierId: string, status?: 'confirmed' | 'draft' | 'cancelled'): Promise<void>;
  setAmountDecimals(tenantId: string, decimals: number): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
