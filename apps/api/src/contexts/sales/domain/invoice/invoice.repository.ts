import { DispatchId } from '../dispatch/dispatch.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { Invoice, InvoiceId, InvoiceStatus } from './invoice.entity.js';

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');

// Lo que la pantalla de facturas ofrece. `text` busca por codigo de factura, codigo de su pedido
// y nombre del cliente. Las fechas se comparan contra la de emision.
export interface InvoiceCriteria {
  text: string | null;
  customerId: string | null;
  status: InvoiceStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface InvoicePage {
  invoices: Invoice[];
  total: number;
}

// Solo lectura: emitir y anular pasan por InvoicePosting, con el despacho o la factura bloqueados.
export interface InvoiceRepository {
  find(tenantId: TenantId, id: InvoiceId): Promise<Invoice | null>;
  searchByTenant(tenantId: TenantId): Promise<Invoice[]>;
  searchPage(tenantId: TenantId, criteria: InvoiceCriteria): Promise<InvoicePage>;
  // Para rechazar pronto una segunda factura; la comprobacion que cuenta es la de InvoicePosting.
  issuedForDispatch(tenantId: TenantId, dispatchId: DispatchId): Promise<boolean>;
}
