import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentFinder } from '../../domain/payment/find/payment-finder.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PaymentRequest } from '../create-payment/payment-creator.js';
import { paymentRates } from '../shared/payment-rates.js';

// Rehace el borrador con las tasas de su dia. Lo aplicado a una factura que ya estaba conserva su
// identificador.
export class PaymentUpdater {
  constructor(
    private readonly finder: PaymentFinder,
    private readonly ledger: ReceivablesLedger,
    private readonly payments: PaymentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PaymentRequest & { paymentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const payment = await this.finder.find(tenantId, PaymentId.of(request.paymentId));
    const previous = payment.toPrimitives().allocations;

    if (!(await this.ledger.customer(tenantId, request.customerId))) throw new ReceivableCustomerNotFoundError(request.customerId);

    const date = request.date ? ReceivablesDate.of(request.date) : ReceivablesDate.of(today);

    date.ensureNotAfter(today);

    const invoices = await this.ledger.invoices(tenantId, { ids: request.allocations.map((allocation) => allocation.invoiceId) });
    // Conservar la moneda vale aunque se haya retirado del catalogo.
    const keepsCurrency = (request.currency ?? '').trim().toUpperCase() === payment.currency().currency;
    const rates = await paymentRates(this.rates, request.tenantId, { currency: request.currency, date: date.value, manualRate: request.exchangeRate, keepsCurrency }, invoices);

    payment.update(
      {
        customerId: request.customerId,
        date,
        method: request.method,
        reference: request.reference,
        notes: request.notes,
        allocations: request.allocations.map((allocation) => ({
          id: previous.find((kept) => kept.invoiceId === allocation.invoiceId)?.id ?? this.ids.next(),
          ...allocation,
        })),
      },
      invoices,
      rates,
      now,
      today,
    );
    payment.ensureFits(invoices);

    await this.payments.save(payment);
  }
}
