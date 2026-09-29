import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { IssuePaymentCannotBeCancelledDirectlyError } from '../../domain/errors/payables.errors.js';
import { PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentPosting } from '../../domain/payment/posting/supplier-payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular un pago confirmado devuelve el saldo a sus facturas.
// Un pago generado por emision de nota de credito no puede anularse desde Pagos: debe anularse la nota.
export class PaymentCanceller {
  constructor(
    private readonly posting: SupplierPaymentPosting,
    private readonly creditNotes: SupplierCreditNoteRepository,
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
