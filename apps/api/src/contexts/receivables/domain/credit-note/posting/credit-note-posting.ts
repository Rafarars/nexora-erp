import { TenantId } from '../../shared/tenant-id.vo.js';
import { CreditNoteId, CustomerCreditNote } from '../customer-credit-note.entity.js';
import { CustomerPayment } from '../../payment/customer-payment.entity.js';

export const CREDIT_NOTE_POSTING = Symbol('CreditNotePosting');

export interface CreditNotePosting {
  confirm(
    tenantId: TenantId,
    noteId: CreditNoteId,
    now: Date,
    today: string,
  ): Promise<{ creditNote: CustomerCreditNote; issuePayment: CustomerPayment | null }>;

  cancel(tenantId: TenantId, noteId: CreditNoteId, now: Date): Promise<void>;
}
