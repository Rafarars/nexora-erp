import { PurchaseInvoiceNotFoundError } from '../../domain/errors/purchasing.errors.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice.entity.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class PurchaseInvoiceFinder {
  constructor(private readonly invoices: PurchaseInvoiceRepository) {}

  async find(tenantId: TenantId, invoiceId: PurchaseInvoiceId): Promise<PurchaseInvoice> {
    const invoice = await this.invoices.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new PurchaseInvoiceNotFoundError(invoiceId.value);
    }
    return invoice;
  }
}
