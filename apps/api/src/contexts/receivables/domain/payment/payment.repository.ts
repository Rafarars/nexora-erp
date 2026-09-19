import { TenantId } from '../shared/tenant-id.vo.js';
import { CustomerPayment, PaymentId, PaymentStatus } from './customer-payment.entity.js';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');

// Lo que la pantalla de cobros ofrece. `text` busca por codigo del cobro y por su referencia, que
// es el numero de transferencia o de cheque con el que la persona lo reconoce. Las fechas se
// comparan contra la del cobro.
export interface PaymentCriteria {
  text: string | null;
  customerId: string | null;
  status: PaymentStatus | null;
  from: string | null;
  to: string | null;
  limit: number;
  offset: number;
}

export interface PaymentPage {
  payments: CustomerPayment[];
  total: number;
}

// Guarda borradores. Confirmar y anular pasan por PaymentPosting, con el cobro y sus facturas
// bloqueados.
export interface PaymentRepository {
  save(payment: CustomerPayment): Promise<void>;
  find(tenantId: TenantId, id: PaymentId): Promise<CustomerPayment | null>;
  searchByTenant(tenantId: TenantId): Promise<CustomerPayment[]>;
  searchPage(tenantId: TenantId, criteria: PaymentCriteria): Promise<PaymentPage>;
}
