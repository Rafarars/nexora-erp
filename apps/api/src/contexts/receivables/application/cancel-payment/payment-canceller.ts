import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { IssuePaymentCannotBeCancelledDirectlyError } from '../../domain/errors/receivables.errors.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular un cobro confirmado devuelve el saldo a sus facturas: si alguna ya vencio, el cliente
// vuelve a tener vencidas y deja de poder facturar a credito.
// Un cobro generado por emision de nota de credito no puede anularse desde Cobros: debe anularse la nota.
export class PaymentCanceller {
  constructor(
    private readonly posting: PaymentPosting,
    private readonly creditNotes: CustomerCreditNoteRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const paymentId = PaymentId.of(request.paymentId);
    const now = this.clock.now();

    const issueNote = await this.creditNotes.findByIssuePayment(tenantId, paymentId);
    if (issueNote && issueNote.currentStatus() !== 'cancelled') {
      throw new IssuePaymentCannotBeCancelledDirectlyError(paymentId.value, issueNote.id.value);
    }

    await this.posting.post(tenantId, paymentId, (payment) => payment.cancel(now));
  }
}
