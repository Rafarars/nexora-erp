import { PayableInvoice } from '../../ledger/payable-invoice.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PaymentId, SupplierPayment } from '../supplier-payment.entity.js';

export const SUPPLIER_PAYMENT_POSTING = Symbol('SupplierPaymentPosting');

// Bloquea el pago y despues sus facturas, en orden fijo, y le pasa al trabajo cada factura con lo
// que le pagaron los DEMAS pagos confirmados. Dos pagos a la misma factura van en fila y el
// segundo ve el saldo que dejo el primero; anular una factura espera a que termine. El trabajo es
// sincrono y puro; si lanza, no se escribe nada.
export interface SupplierPaymentPosting {
  post(tenantId: TenantId, paymentId: PaymentId, work: (payment: SupplierPayment, invoices: PayableInvoice[]) => void): Promise<void>;
}
