import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { ReceivablesCodeSequence, receivablesCode } from '../../domain/shared/code-sequence.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PaymentRequest {
  tenantId: string;
  customerId: string;
  date?: string | null;
  method: string;
  reference?: string | null;
  notes?: string | null;
  allocations: { invoiceId: string; amount: number }[];
}

// Registra un cobro en borrador. Se comprueba contra los saldos de hoy para avisar pronto; la
// comprobacion que cuenta es la de confirmar, con las facturas bloqueadas.
export class PaymentCreator {
  constructor(
    private readonly ledger: ReceivablesLedger,
    private readonly payments: PaymentRepository,
    private readonly codes: ReceivablesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: PaymentRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Un cliente inactivo sigue debiendo: se le puede cobrar.
    if (!(await this.ledger.customer(tenantId, request.customerId))) throw new ReceivableCustomerNotFoundError(request.customerId);

    const id = PaymentId.of(this.ids.next());
    const details = {
      customerId: request.customerId,
      date: request.date ? ReceivablesDate.of(request.date) : ReceivablesDate.of(today),
      method: request.method,
      reference: request.reference,
      notes: request.notes,
      allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation })),
    };
    const candidate = CustomerPayment.draft(id, tenantId, receivablesCode('COB', 0), details, now, today);

    candidate.ensureFits(await this.ledger.invoices(tenantId, { ids: candidate.invoiceIds() }));

    const code = receivablesCode('COB', await this.codes.next(tenantId, 'COB'));

    await this.payments.save(CustomerPayment.draft(id, tenantId, code, details, now, today));
  }
}
