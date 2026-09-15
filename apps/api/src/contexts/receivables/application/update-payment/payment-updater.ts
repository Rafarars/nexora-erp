import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentFinder } from '../../domain/payment/find/payment-finder.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PaymentRequest } from '../create-payment/payment-creator.js';

// Rehace el borrador. Lo aplicado a una factura que ya estaba conserva su identificador.
export class PaymentUpdater {
  constructor(
    private readonly finder: PaymentFinder,
    private readonly ledger: ReceivablesLedger,
    private readonly payments: PaymentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: PaymentRequest & { paymentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const payment = await this.finder.find(tenantId, PaymentId.of(request.paymentId));
    const previous = payment.toPrimitives().allocations;

    if (!(await this.ledger.customer(tenantId, request.customerId))) throw new ReceivableCustomerNotFoundError(request.customerId);

    payment.update(
      {
        customerId: request.customerId,
        date: request.date ? ReceivablesDate.of(request.date) : ReceivablesDate.of(today),
        method: request.method,
        reference: request.reference,
        notes: request.notes,
        allocations: request.allocations.map((allocation) => ({
          id: previous.find((kept) => kept.invoiceId === allocation.invoiceId)?.id ?? this.ids.next(),
          ...allocation,
        })),
      },
      now,
      today,
    );
    payment.ensureFits(await this.ledger.invoices(tenantId, { ids: payment.invoiceIds() }));

    await this.payments.save(payment);
  }
}
