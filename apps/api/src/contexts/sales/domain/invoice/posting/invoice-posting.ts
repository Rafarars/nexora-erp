import { Dispatch, DispatchId } from '../../dispatch/dispatch.entity.js';
import { SalesOrder } from '../../order/sales-order.entity.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Invoice, InvoiceId } from '../invoice.entity.js';

export const INVOICE_POSTING = Symbol('InvoicePosting');

// Emitir bloquea el despacho y lee, ya bloqueado, si tiene una factura emitida: dos emisiones a la
// vez del mismo despacho van en fila y la segunda se rechaza. La base lo respalda con un indice
// unico parcial. Anular bloquea la factura. Los trabajos son sincronos y puros.
export interface InvoicePosting {
  issue(tenantId: TenantId, dispatchId: DispatchId, work: (dispatch: Dispatch, order: SalesOrder, alreadyInvoiced: boolean) => Invoice): Promise<void>;
  cancel(tenantId: TenantId, invoiceId: InvoiceId, work: (invoice: Invoice) => void): Promise<void>;
}
