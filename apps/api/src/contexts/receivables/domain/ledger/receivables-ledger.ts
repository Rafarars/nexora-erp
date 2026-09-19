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

// Lo que la pantalla de saldos puede pedir de un cliente: `text` busca por codigo y por nombre.
export interface ReceivableCustomerFilter {
  text?: string | null;
}

// Lo que la pantalla de facturas por cobrar puede pedir. `text` busca por codigo de factura y por
// nombre de cliente, que es por lo que alguien busca una factura. Las fechas se comparan contra la
// de vencimiento, que es la que decide si esta vencida.
export interface ReceivableInvoiceFilter {
  customerId?: string | null;
  ids?: string[];
  text?: string | null;
  // Solo las emitidas: una anulada ya no se cobra.
  onlyIssued?: boolean;
  from?: string | null;
  to?: string | null;
}

// Lo que cuentas por cobrar lee de ventas: clientes y facturas, con lo cobrado de cada una. En la
// base el adaptador lee las tablas de ventas; el dominio no sabe que existen.
//
// No pagina: el saldo, el estado de cobro y el tramo de antiguedad no son columnas, salen de restar
// lo cobrado. Cortar la pagina aqui daria un total calculado sobre veinte filas. El filtro baja lo
// que la base sabe responder y el caso de uso corta la pagina sobre todo lo que queda.
export interface ReceivablesLedger {
  customers(tenantId: TenantId, filter?: ReceivableCustomerFilter): Promise<ReceivableCustomer[]>;
  customer(tenantId: TenantId, customerId: string): Promise<ReceivableCustomer | null>;
  // Emitidas y anuladas, las mas recientes primero. Sin filtro, todas las de la empresa.
  invoices(tenantId: TenantId, filter?: ReceivableInvoiceFilter): Promise<ReceivableInvoice[]>;
}
