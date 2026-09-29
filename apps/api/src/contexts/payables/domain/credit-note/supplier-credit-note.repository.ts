import { PaymentId } from '../payment/supplier-payment.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierCreditNote, SupplierCreditNoteId } from './supplier-credit-note.entity.js';

export const SUPPLIER_CREDIT_NOTE_REPOSITORY = Symbol('SupplierCreditNoteRepository');

export interface SupplierCreditNoteSearchFilter {
  supplierId?: string;
  invoiceId?: string;
  purchaseReturnId?: string;
  status?: string;
  from?: string;
  to?: string;
  text?: string;
  limit?: number;
  offset?: number;
}

export interface SupplierCreditNoteRepository {
  save(note: SupplierCreditNote): Promise<void>;
  find(tenantId: TenantId, id: SupplierCreditNoteId): Promise<SupplierCreditNote | null>;
  findByIds(tenantId: TenantId, ids: SupplierCreditNoteId[]): Promise<SupplierCreditNote[]>;
  findByIssuePayment(tenantId: TenantId, paymentId: PaymentId): Promise<SupplierCreditNote | null>;
  findByIssuePayments(tenantId: TenantId, paymentIds: PaymentId[]): Promise<SupplierCreditNote[]>;
  searchPage(
    tenantId: TenantId,
    filter: SupplierCreditNoteSearchFilter,
  ): Promise<{ notes: SupplierCreditNote[]; total: number }>;
  creditedAmountByInvoice(tenantId: TenantId, invoiceId: string): Promise<number>;
  creditedAmountByInvoiceLines(
    tenantId: TenantId,
    invoiceLineIds: string[],
    excludeNoteId?: SupplierCreditNoteId,
  ): Promise<Map<string, number>>;
  creditedNotesByReturn(tenantId: TenantId, purchaseReturnId: string): Promise<SupplierCreditNote[]>;
  appliedPaymentsSum(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    excludePaymentId?: string | null,
  ): Promise<number>;
  appliedAmountsByNotes(
    tenantId: TenantId,
    noteIds: SupplierCreditNoteId[],
    excludePaymentId?: string | null,
  ): Promise<Map<string, number>>;
  hasConfirmedPaymentsOtherThan(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    excludePaymentId: string | null,
  ): Promise<boolean>;
  findAvailableCreditsBySupplier(tenantId: TenantId, supplierId: string): Promise<SupplierCreditNote[]>;
}
