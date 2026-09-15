import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Confirmar baja el saldo de cada factura en lo que el cobro le aplica.
export class PaymentConfirmer {
  constructor(
    private readonly posting: PaymentPosting,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    await this.posting.post(TenantId.of(request.tenantId), PaymentId.of(request.paymentId), (payment, invoices) => payment.confirm(invoices, now, today));
  }
}
