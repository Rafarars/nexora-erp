import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PurchaseInvoicePosting } from '../../domain/invoice/posting/purchase-invoice-posting.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseInvoiceConfirmerRequest {
  tenantId: string;
  invoiceId: string;
}

export class PurchaseInvoiceConfirmer {
  constructor(
    private readonly posting: PurchaseInvoicePosting,
    private readonly clock: Clock,
  ) {}

  async run(request: PurchaseInvoiceConfirmerRequest): Promise<PurchaseInvoice> {
    const tenantId = TenantId.of(request.tenantId);
    const invoiceId = PurchaseInvoiceId.of(request.invoiceId);
    const now = this.clock.now();

    return this.posting.confirm(tenantId, invoiceId, now);
  }
}
