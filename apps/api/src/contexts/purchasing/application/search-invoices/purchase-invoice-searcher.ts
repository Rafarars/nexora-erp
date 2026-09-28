import { PurchaseInvoice, PurchaseInvoiceStatus } from '../../domain/invoice/purchase-invoice.entity.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseInvoiceSearchRequest {
  tenantId: string;
  supplierId?: string;
  status?: PurchaseInvoiceStatus;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

export class PurchaseInvoiceSearcher {
  constructor(
    private readonly invoices: PurchaseInvoiceRepository,
    private readonly suppliers?: SupplierFinder,
  ) {}

  async run(request: PurchaseInvoiceSearchRequest): Promise<{ invoices: PurchaseInvoice[]; total: number }> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.supplierId && this.suppliers) {
      await this.suppliers.find(tenantId, SupplierId.of(request.supplierId));
    }

    return this.invoices.search(tenantId, {
      supplierId: request.supplierId,
      status: request.status,
      fromDate: request.fromDate,
      toDate: request.toDate,
      limit: request.limit,
      offset: request.offset,
    });
  }
}
