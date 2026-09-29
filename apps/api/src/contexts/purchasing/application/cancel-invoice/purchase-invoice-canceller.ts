import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PurchaseInvoicePosting } from '../../domain/invoice/posting/purchase-invoice-posting.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseInvoiceCancellerRequest {
  tenantId: string;
  invoiceId: string;
  userId?: string;
}

export class PurchaseInvoiceCanceller {
  constructor(
    private readonly posting: PurchaseInvoicePosting,
    private readonly clock: Clock,
  ) {}

  async run(request: PurchaseInvoiceCancellerRequest): Promise<PurchaseInvoice> {
    const tenantId = TenantId.of(request.tenantId);
    const invoiceId = PurchaseInvoiceId.of(request.invoiceId);
    const now = this.clock.now();

    return this.posting.cancel(tenantId, invoiceId, now, request.userId);
  }
}
