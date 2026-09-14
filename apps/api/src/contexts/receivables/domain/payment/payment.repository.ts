import { TenantId } from '../shared/tenant-id.vo.js';
import { CustomerPayment, PaymentId } from './customer-payment.entity.js';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');

// Guarda borradores. Confirmar y anular pasan por PaymentPosting, con el cobro y sus facturas
// bloqueados.
export interface PaymentRepository {
  save(payment: CustomerPayment): Promise<void>;
  find(tenantId: TenantId, id: PaymentId): Promise<CustomerPayment | null>;
  searchByTenant(tenantId: TenantId): Promise<CustomerPayment[]>;
}
