import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Confirmar baja el saldo de cada factura en lo que el cobro le aplica.
export class PaymentConfirmer {
  constructor(
    private readonly posting: PaymentPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), PaymentId.of(request.paymentId), (payment, invoices) => payment.confirm(invoices, now));
  }
}
