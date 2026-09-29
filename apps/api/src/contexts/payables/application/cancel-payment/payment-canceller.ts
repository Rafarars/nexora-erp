import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PaymentId } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentPosting } from '../../domain/payment/posting/supplier-payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface IssuePaymentChecker {
  isIssuePaymentOfActiveNote(tenantId: TenantId, paymentId: PaymentId): Promise<boolean>;
}

// Anular un pago confirmado devuelve el saldo a sus facturas.
// Un pago generado por emision de nota de credito no puede anularse desde Pagos: debe anularse la nota.
export class PaymentCanceller {
  constructor(
    private readonly posting: SupplierPaymentPosting,
    private readonly clock: Clock,
    private readonly noteChecker?: IssuePaymentChecker,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const paymentId = PaymentId.of(request.paymentId);
    const now = this.clock.now();

    if (this.noteChecker && (await this.noteChecker.isIssuePaymentOfActiveNote(tenantId, paymentId))) {
      // H9 §3.10: El pago de emision de una NCP no se anula desde Pagos
      throw new Error(`Payment <${paymentId.value}> was issued by a credit note and cannot be cancelled directly.`);
    }

    await this.posting.post(tenantId, paymentId, (payment) => payment.cancel(now));
  }
}
