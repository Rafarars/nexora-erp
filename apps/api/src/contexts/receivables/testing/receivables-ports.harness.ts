import { ReceivableInvoicePrimitives } from '../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer, ReceivablesLedger } from '../domain/ledger/receivables-ledger.js';
import { PaymentRepository } from '../domain/payment/payment.repository.js';
import { PaymentPosting } from '../domain/payment/posting/payment-posting.js';
import { ReceivablesCodeSequence } from '../domain/shared/code-sequence.js';

import { CustomerCreditNoteRepository } from '../domain/credit-note/customer-credit-note.repository.js';
import { CreditNotePosting } from '../domain/credit-note/posting/credit-note-posting.js';

export interface ReceivablesPorts {
  payments: PaymentRepository;
  posting: PaymentPosting;
  ledger: ReceivablesLedger;
  codes: ReceivablesCodeSequence;
  creditNotes: CustomerCreditNoteRepository;
  creditNotePosting: CreditNotePosting;
}

// Deja cuentas por cobrar vacio y siembra lo que en la base escribe ventas: clientes y facturas.
export interface ReceivablesPortsHarness {
  ports(): ReceivablesPorts;
  customer(tenantId: string, customer: ReceivableCustomer): Promise<void>;
  invoice(tenantId: string, invoice: Omit<ReceivableInvoicePrimitives, 'paid'>): Promise<void>;
  cancelInvoice(tenantId: string, invoiceId: string): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
