import { Clock } from '../../../../shared/domain/ports/clock.js';
import { InvoiceId } from '../../domain/invoice/invoice.entity.js';
import { InvoiceIssuance } from '../../domain/invoice/posting/invoice-issuance.js';
import { InvoicePosting } from '../../domain/invoice/posting/invoice-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular una factura no toca existencia ni despacho: el despacho vuelve a poder facturarse o
// anularse, y lo facturado vuelve a las lineas del pedido. Una factura con cobros confirmados no se
// anula.
export class InvoiceCanceller {
  constructor(
    private readonly posting: InvoicePosting,
    private readonly issuance: InvoiceIssuance,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; invoiceId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.cancel(TenantId.of(request.tenantId), InvoiceId.of(request.invoiceId), (invoice, order, paid) =>
      this.issuance.cancel(invoice, order, paid, now),
    );
  }
}
