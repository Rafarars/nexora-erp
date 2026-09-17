import { CustomerId } from '../../customer/customer.entity.js';
import { Dispatch, DispatchId } from '../../dispatch/dispatch.entity.js';
import { SalesOrder } from '../../order/sales-order.entity.js';
import { SalesDate } from '../../shared/sales-date.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CustomerCredit } from '../credit/customer-credit.js';
import { Invoice, InvoiceId } from '../invoice.entity.js';

export const INVOICE_POSTING = Symbol('InvoicePosting');

// Emitir bloquea el despacho, su pedido y el cliente, en ese orden, y lee ya bloqueados si el
// despacho tiene factura y cuanto debe el cliente: dos emisiones del mismo despacho, o dos a
// credito del mismo cliente, van en fila. La base respalda la primera regla con un indice unico
// parcial. Anular bloquea la factura y lee lo cobrado. Los trabajos son sincronos y puros.
export interface InvoicePosting {
  // Sin bloqueo, para rechazar antes de gastar un numero.
  // `decimals`: los de la empresa, con los que se redondea lo que debe cada factura.
  credit(tenantId: TenantId, customerId: CustomerId, today: SalesDate, decimals: number): Promise<CustomerCredit>;
  issue(
    tenantId: TenantId,
    dispatchId: DispatchId,
    today: SalesDate,
    decimals: number,
    work: (dispatch: Dispatch, order: SalesOrder, alreadyInvoiced: boolean, credit: CustomerCredit) => Invoice,
  ): Promise<void>;
  cancel(tenantId: TenantId, invoiceId: InvoiceId, work: (invoice: Invoice, paid: number) => void): Promise<void>;
}
