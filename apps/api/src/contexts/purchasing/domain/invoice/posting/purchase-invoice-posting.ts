import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseInvoice, PurchaseInvoiceId } from '../purchase-invoice.entity.js';

export const PURCHASE_INVOICE_POSTING = Symbol('PurchaseInvoicePosting');

export interface PurchaseInvoicePosting {
  confirm(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date): Promise<PurchaseInvoice>;
  cancel(tenantId: TenantId, invoiceId: PurchaseInvoiceId, now: Date): Promise<PurchaseInvoice>;
}
