import { ReceivableInvoice } from '../../ledger/receivable-invoice.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CustomerPayment, PaymentId } from '../customer-payment.entity.js';

export const PAYMENT_POSTING = Symbol('PaymentPosting');

// Bloquea el cobro y despues sus facturas, en orden fijo, y le pasa al trabajo cada factura con lo
// que le cobraron los DEMAS cobros confirmados. Dos cobros a la misma factura van en fila y el
// segundo ve el saldo que dejo el primero; anular una factura espera a que termine. El trabajo es
// sincrono y puro; si lanza, no se escribe nada.
export interface PaymentPosting {
  post(tenantId: TenantId, paymentId: PaymentId, work: (payment: CustomerPayment, invoices: ReceivableInvoice[]) => void): Promise<void>;
}
