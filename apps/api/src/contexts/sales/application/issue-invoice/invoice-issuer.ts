import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { CustomerFinder } from '../../domain/customer/find/customer-finder.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
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
// correlativos en facturas imposibles, y otra vez con el despacho bloqueado.
export class InvoiceIssuer {
  constructor(
    private readonly dispatches: DispatchFinder,
    private readonly orders: SalesOrderFinder,
    private readonly customers: CustomerFinder,
    private readonly invoices: InvoiceRepository,
    private readonly posting: InvoicePosting,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: InvoiceIssuerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const dispatch = await this.dispatches.find(tenantId, DispatchId.of(request.dispatchId));
    const order = await this.orders.find(tenantId, dispatch.orderId);
    const customer = await this.customers.find(tenantId, order.customerId());
    const id = InvoiceId.of(this.ids.next());
    const date = request.date ? SalesDate.of(request.date) : SalesDate.fromDate(now);
    const issue = (code: string, current = dispatch, currentOrder = order, alreadyInvoiced = false) =>
      Invoice.issue(id, tenantId, code, {
        dispatch: current,
        order: currentOrder,
        alreadyInvoiced,
        // El plazo del cliente de hoy: es el que rige desde que se emite.
        paymentTermDays: customer.toPrimitives().paymentTermDays,
        date,
        notes: request.notes ?? null,
        lineIds: () => this.ids.next(),
      }, now);

    issue(salesCode('FAC', 0), dispatch, order, await this.invoices.issuedForDispatch(tenantId, dispatch.id));

    const code = salesCode('FAC', await this.codes.next(tenantId, 'FAC'));

    await this.posting.issue(tenantId, dispatch.id, (locked, lockedOrder, alreadyInvoiced) => issue(code, locked, lockedOrder, alreadyInvoiced));
  }
}
