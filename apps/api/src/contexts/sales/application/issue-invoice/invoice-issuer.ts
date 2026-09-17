import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
import { CustomerCredit } from '../../domain/invoice/credit/customer-credit.js';
import { Invoice, InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface InvoiceIssuerRequest {
  tenantId: string;
  dispatchId: string;
  date?: string | null;
  notes?: string | null;
}

// Emite la factura de un despacho confirmado. Se valida antes de pedir el numero, para no gastar
// correlativos en facturas imposibles, y otra vez con el despacho y el cliente bloqueados.
export class InvoiceIssuer {
  constructor(
    private readonly dispatches: DispatchFinder,
    private readonly orders: SalesOrderFinder,
    private readonly invoices: InvoiceRepository,
    private readonly posting: InvoicePosting,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: InvoiceIssuerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const dispatch = await this.dispatches.find(tenantId, DispatchId.of(request.dispatchId));
    const order = await this.orders.find(tenantId, dispatch.orderId);
    const today = SalesDate.of(await this.calendar.today(request.tenantId));
    const credit = await this.posting.credit(tenantId, order.customerId(), today);
    const id = InvoiceId.of(this.ids.next());
    const date = request.date ? SalesDate.of(request.date) : today;

    // La fecha antes que las tasas: una factura futura no pregunta por ellas.
    date.ensureNotAfter(today.value);

    // La moneda del pedido, con las tasas del dia de emision: la ley pide la tasa de la factura.
    const [rates, amountDecimals] = await Promise.all([
      this.rates.forDocument(request.tenantId, { currency: order.currency().currency, date: date.value, keepsCurrency: true }),
      this.rates.amountDecimals(request.tenantId),
    ]);
    const currency = DocumentCurrency.of(rates);
    const issue = (code: string, current = dispatch, currentOrder = order, alreadyInvoiced = false, currentCredit: CustomerCredit = credit) =>
      Invoice.issue(id, tenantId, code, {
        dispatch: current,
        order: currentOrder,
        alreadyInvoiced,
        // El plazo y el limite del cliente de hoy: son los que rigen desde que se emite.
        credit: currentCredit,
        date,
        currency,
        amountDecimals,
        notes: request.notes ?? null,
        lineIds: () => this.ids.next(),
      }, now, today.value);

    issue(salesCode('FAC', 0), dispatch, order, await this.invoices.issuedForDispatch(tenantId, dispatch.id));

    const code = salesCode('FAC', await this.codes.next(tenantId, 'FAC'));

    await this.posting.issue(tenantId, dispatch.id, today, (locked, lockedOrder, alreadyInvoiced, lockedCredit) => issue(code, locked, lockedOrder, alreadyInvoiced, lockedCredit));
  }
}
