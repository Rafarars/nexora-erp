import { TenantId } from '../shared/tenant-id.vo.js';
import { PaymentId, PaymentStatus, SupplierPayment } from './supplier-payment.entity.js';

export const SUPPLIER_PAYMENT_REPOSITORY = Symbol('SupplierPaymentRepository');

// Lo que la pantalla de pagos ofrece. `text` busca por codigo del pago y por su referencia, que
// es el numero de transferencia o de cheque con el que la persona lo reconoce. Las fechas se
// comparan contra la del pago.
export interface SupplierPaymentCriteria {
  text: string | null;
  supplierId: string | null;
  status: PaymentStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface SupplierPaymentPage {
  payments: SupplierPayment[];
  total: number;
}

// Guarda borradores. Confirmar y anular pasan por SupplierPaymentPosting, con el pago y sus facturas
// bloqueados.
export interface SupplierPaymentRepository {
  save(payment: SupplierPayment): Promise<void>;
  find(tenantId: TenantId, id: PaymentId): Promise<SupplierPayment | null>;
  searchByTenant(tenantId: TenantId): Promise<SupplierPayment[]>;
  searchPage(tenantId: TenantId, criteria: SupplierPaymentCriteria): Promise<SupplierPaymentPage>;
}
