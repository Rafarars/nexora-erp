import { TenantId } from '../shared/tenant-id.vo.js';
import { ReceivableInvoice } from './receivable-invoice.js';

export const RECEIVABLES_LEDGER = Symbol('ReceivablesLedger');

export interface ReceivableCustomer {
  id: string;
  code: string;
  name: string;
  paymentTermDays: number;
  creditLimit: number | null;
  isActive: boolean;
}

// Lo que cuentas por cobrar lee de ventas: clientes y facturas, con lo cobrado de cada una. En la
// base el adaptador lee las tablas de ventas; el dominio no sabe que existen.
export interface ReceivablesLedger {
  customers(tenantId: TenantId): Promise<ReceivableCustomer[]>;
  customer(tenantId: TenantId, customerId: string): Promise<ReceivableCustomer | null>;
  // Emitidas y anuladas, las mas recientes primero. Sin filtro, todas las de la empresa.
  invoices(tenantId: TenantId, filter?: { customerId?: string; ids?: string[] }): Promise<ReceivableInvoice[]>;
}
