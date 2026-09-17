import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerPayment, PaymentId } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { ReceivablesCodeSequence, receivablesCode } from '../../domain/shared/code-sequence.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { paymentRates } from '../shared/payment-rates.js';

export interface PaymentRequest {
  tenantId: string;
  customerId: string;
  date?: string | null;
  method: string;
  reference?: string | null;
  notes?: string | null;
  // Sin moneda, la de la empresa.
  currency?: string | null;
  // Vacia, la tasa del dia del cobro.
  exchangeRate?: number | null;
  // Cada importe en la moneda de su factura.
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
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PaymentRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Un cliente inactivo sigue debiendo: se le puede cobrar.
    if (!(await this.ledger.customer(tenantId, request.customerId))) throw new ReceivableCustomerNotFoundError(request.customerId);

    const date = request.date ? ReceivablesDate.of(request.date) : ReceivablesDate.of(today);

    // La fecha antes que las tasas: un cobro futuro no pregunta por ellas.
    date.ensureNotAfter(today);

    const invoices = await this.ledger.invoices(tenantId, { ids: request.allocations.map((allocation) => allocation.invoiceId) });
    const rates = await paymentRates(this.rates, request.tenantId, { currency: request.currency, date: date.value, manualRate: request.exchangeRate, keepsCurrency: false }, invoices);
    const id = PaymentId.of(this.ids.next());
    const details = {
      customerId: request.customerId,
      date,
      method: request.method,
      reference: request.reference,
      notes: request.notes,
      allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation })),
    };
    const candidate = CustomerPayment.draft(id, tenantId, receivablesCode('COB', 0), details, invoices, rates, now, today);

    candidate.ensureFits(invoices);

    const code = receivablesCode('COB', await this.codes.next(tenantId, 'COB'));

    await this.payments.save(CustomerPayment.draft(id, tenantId, code, details, invoices, rates, now, today));
  }
}
