import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PaymentId, SupplierPayment } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { PayablesCodeSequence, payablesCode } from '../../domain/shared/code-sequence.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { paymentRates } from '../shared/payment-rates.js';

export interface PaymentRequest {
  tenantId: string;
  supplierId: string;
  date?: string | null;
  method: string;
  creditSourceId?: string | null;
  reference?: string | null;
  notes?: string | null;
  // Sin moneda, la de la empresa.
  currency?: string | null;
  // Vacia, la tasa del dia del pago.
  exchangeRate?: number | null;
  // Cada importe en la moneda de su factura.
  allocations: { invoiceId: string; amount: number }[];
}

// Registra un pago a proveedor en borrador. Se comprueba contra los saldos de hoy para avisar pronto; la
// comprobacion que cuenta es la de confirmar, con las facturas bloqueadas.
export class PaymentCreator {
  constructor(
    private readonly ledger: PayablesLedger,
    private readonly payments: SupplierPaymentRepository,
    private readonly codes: PayablesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PaymentRequest): Promise<{ id: string; code: string }> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Un proveedor inactivo sigue cobrando lo pendiente: se le puede pagar.
    if (!(await this.ledger.supplier(tenantId, request.supplierId))) throw new PayableSupplierNotFoundError(request.supplierId);

    const date = request.date ? PayablesDate.of(request.date) : PayablesDate.of(today);

    // La fecha antes que las tasas: un pago futuro no pregunta por ellas.
    date.ensureNotAfter(today);

    const invoices = await this.ledger.invoices(tenantId, { ids: request.allocations.map((allocation) => allocation.invoiceId) });
    const rates = await paymentRates(this.rates, request.tenantId, { currency: request.currency, date: date.value, manualRate: request.exchangeRate, keepsCurrency: false }, invoices);
    const id = PaymentId.of(this.ids.next());
    const details = {
      supplierId: request.supplierId,
      date,
      method: request.method,
      creditSourceId: request.creditSourceId,
      reference: request.reference,
      notes: request.notes,
      allocations: request.allocations.map((allocation) => ({ id: this.ids.next(), ...allocation })),
    };
    const candidate = SupplierPayment.draft(id, tenantId, payablesCode('PAG', 0), details, invoices, rates, now, today);

    candidate.ensureFits(invoices);

    const code = payablesCode('PAG', await this.codes.next(tenantId, 'PAG'));

    await this.payments.save(SupplierPayment.draft(id, tenantId, code, details, invoices, rates, now, today));

    return { id: id.value, code };
  }
}
