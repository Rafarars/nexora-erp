import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular un cobro confirmado devuelve el saldo a sus facturas: si alguna ya vencio, el cliente
// vuelve a tener vencidas y deja de poder facturar a credito.
export class PaymentCanceller {
  constructor(
    private readonly posting: PaymentPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), PaymentId.of(request.paymentId), (payment) => payment.cancel(now));
  }
}
