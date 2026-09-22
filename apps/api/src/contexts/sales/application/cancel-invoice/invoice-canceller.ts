import { Clock } from '../../../../shared/domain/ports/clock.js';
import { InvoiceWithReturnsError } from '../../domain/errors/sales.errors.js';
import { InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoiceIssuance } from '../../domain/invoice/posting/invoice-issuance.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { SalesReturnsOfInvoice } from '../../domain/invoice/returns/sales-returns-of-invoice.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular una factura no toca existencia ni despacho: el despacho vuelve a poder facturarse o
// anularse, y lo facturado vuelve a las lineas del pedido. Una factura con cobros confirmados
// o con mercancia devuelta de sus lineas no se anula.
export class InvoiceCanceller {
  constructor(
    private readonly posting: InvoicePosting,
    private readonly issuance: InvoiceIssuance,
    private readonly returnsOfInvoice: SalesReturnsOfInvoice,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; invoiceId: string }): Promise<void> {
    const now = this.clock.now();
    const tenantId = TenantId.of(request.tenantId);

    await this.posting.cancel(tenantId, InvoiceId.of(request.invoiceId), async (invoice, order, paid) => {
      const orderLineIds = invoice.invoicedLines().map((line) => line.orderLineId);
      const returnsCount = await this.returnsOfInvoice.countConfirmedReturnsOf(tenantId, orderLineIds);
      if (returnsCount > 0) throw new InvoiceWithReturnsError(request.invoiceId);

      this.issuance.cancel(invoice, order, paid, now);
    });
  }
}
