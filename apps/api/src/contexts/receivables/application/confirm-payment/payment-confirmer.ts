import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentFinder } from '../../domain/payment/find/payment-finder.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { paymentRates } from '../shared/payment-rates.js';

// Confirmar congela las tasas del dia del cobro, salvo la escrita a mano, y baja el saldo de cada
// factura en lo que el cobro le aplica.
export class PaymentConfirmer {
  constructor(
    private readonly finder: PaymentFinder,
    private readonly ledger: ReceivablesLedger,
    private readonly posting: PaymentPosting,
    private readonly rates: DocumentRates,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; paymentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const payment = await this.finder.find(tenantId, PaymentId.of(request.paymentId));
    const currency = payment.currency();
    const rates =
      payment.currentStatus() === 'draft'
        ? await paymentRates(
            this.rates,
            request.tenantId,
            { currency: currency.currency, date: payment.paymentDate().value, manualRate: currency.manualRate(), keepsCurrency: true },
            await this.ledger.invoices(tenantId, { ids: payment.invoiceIds() }),
          )
        : null;

    await this.posting.post(tenantId, payment.id, (locked, invoices) => {
      locked.ensureUnchangedSince(payment.version());
      locked.confirm(invoices, rates, now, today);
    });
  }
}
