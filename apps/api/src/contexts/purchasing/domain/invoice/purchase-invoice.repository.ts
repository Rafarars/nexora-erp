import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { PurchaseInvoice, PurchaseInvoiceId, PurchaseInvoiceStatus } from './purchase-invoice.entity.js';

export const PURCHASE_INVOICE_REPOSITORY = Symbol('PurchaseInvoiceRepository');

export interface PurchaseInvoiceSearchCriteria {
  supplierId?: string;
  status?: PurchaseInvoiceStatus;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

export interface PurchaseInvoiceRepository {
  save(invoice: PurchaseInvoice): Promise<void>;
  findById(tenantId: TenantId, id: PurchaseInvoiceId): Promise<PurchaseInvoice | null>;
  findByCode(tenantId: TenantId, code: string): Promise<PurchaseInvoice | null>;
  // Devuelve factura activa si existe con ese proveedor y numero normalizado
  findActiveBySupplierNumber(tenantId: TenantId, supplierId: SupplierId, number: string): Promise<PurchaseInvoice | null>;
  search(tenantId: TenantId, criteria: PurchaseInvoiceSearchCriteria): Promise<{ invoices: PurchaseInvoice[]; total: number }>;
  // Cantidades ya facturadas en facturas confirmadas por cada linea de entrada
  invoicedQuantitiesByReceiptLine(
    tenantId: TenantId,
    receiptLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>>;
  // Cantidades ya facturadas en facturas confirmadas por cada linea de orden directa
  invoicedQuantitiesByOrderLine(
    tenantId: TenantId,
    orderLineIds: string[],
    excludeInvoiceId?: string,
  ): Promise<Map<string, number>>;
}
