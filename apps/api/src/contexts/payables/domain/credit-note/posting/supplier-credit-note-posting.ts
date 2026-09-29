import { TenantId } from '../../shared/tenant-id.vo.js';
import { SupplierCreditNote, SupplierCreditNoteId } from '../supplier-credit-note.entity.js';
import { SupplierPayment } from '../../payment/supplier-payment.entity.js';

export const SUPPLIER_CREDIT_NOTE_POSTING = Symbol('SupplierCreditNotePosting');

export interface SupplierCreditNotePosting {
  confirm(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    now: Date,
    today: string,
    userId?: string | null,
  ): Promise<{ creditNote: SupplierCreditNote; issuePayment: SupplierPayment | null }>;

  cancel(
    tenantId: TenantId,
    noteId: SupplierCreditNoteId,
    now: Date,
    userId?: string | null,
  ): Promise<void>;
}
