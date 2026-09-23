import { PaymentId } from '../payment/customer-payment.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { CreditNoteId, CustomerCreditNote } from './customer-credit-note.entity.js';

export const CUSTOMER_CREDIT_NOTE_REPOSITORY = Symbol('CustomerCreditNoteRepository');

export interface CreditNoteSearchFilter {
  customerId?: string;
  invoiceId?: string;
  salesReturnId?: string;
  status?: string;
  from?: string;
  to?: string;
  text?: string;
  limit?: number;
  offset?: number;
}

export interface CustomerCreditNoteRepository {
  save(note: CustomerCreditNote): Promise<void>;
  find(tenantId: TenantId, id: CreditNoteId): Promise<CustomerCreditNote | null>;
  findByIds(tenantId: TenantId, ids: CreditNoteId[]): Promise<CustomerCreditNote[]>;
  findByIssuePayment(tenantId: TenantId, paymentId: PaymentId): Promise<CustomerCreditNote | null>;
  searchPage(tenantId: TenantId, filter: CreditNoteSearchFilter): Promise<{ notes: CustomerCreditNote[]; total: number }>;
  creditedAmountByInvoice(tenantId: TenantId, invoiceId: string): Promise<number>;
  creditedNotesByReturn(tenantId: TenantId, salesReturnId: string): Promise<CustomerCreditNote[]>;
  appliedPaymentsSum(tenantId: TenantId, noteId: CreditNoteId, excludePaymentId?: string | null): Promise<number>;
  appliedAmountsByNotes(tenantId: TenantId, noteIds: CreditNoteId[], excludePaymentId?: string | null): Promise<Map<string, number>>;
  hasConfirmedPaymentsOtherThan(tenantId: TenantId, noteId: CreditNoteId, excludePaymentId: string | null): Promise<boolean>;
  findAvailableCreditsByCustomer(tenantId: TenantId, customerId: string): Promise<CustomerCreditNote[]>;
}
