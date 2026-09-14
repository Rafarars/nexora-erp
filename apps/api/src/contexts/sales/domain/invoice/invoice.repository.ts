import { DispatchId } from '../dispatch/dispatch.entity.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { Invoice, InvoiceId } from './invoice.entity.js';

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');

// Solo lectura: emitir y anular pasan por InvoicePosting, con el despacho o la factura bloqueados.
export interface InvoiceRepository {
  find(tenantId: TenantId, id: InvoiceId): Promise<Invoice | null>;
  searchByTenant(tenantId: TenantId): Promise<Invoice[]>;
  // Para rechazar pronto una segunda factura; la comprobacion que cuenta es la de InvoicePosting.
  issuedForDispatch(tenantId: TenantId, dispatchId: DispatchId): Promise<boolean>;
}
