import { TenantId } from '../shared/tenant-id.vo.js';
import { PayableInvoice } from './payable-invoice.js';

export const PAYABLES_LEDGER = Symbol('PayablesLedger');

export interface PayableSupplier {
  id: string;
  code: string;
  name: string;
  paymentTermDays: number;
  isActive: boolean;
}

// Lo que la pantalla de saldos puede pedir de un proveedor: `text` busca por codigo y por nombre.
export interface PayableSupplierFilter {
  text?: string | null;
}

// Lo que la pantalla de facturas por pagar puede pedir. `text` busca por codigo de factura,
// numero de factura del proveedor y nombre de proveedor.
export interface PayableInvoiceFilter {
  supplierId?: string | null;
  ids?: string[];
  text?: string | null;
  // Solo las confirmadas: una en borrador o anulada ya no se paga.
  onlyConfirmed?: boolean;
  from?: string | null;
  to?: string | null;
}

export interface PayableInvoiceLineInfo {
  id: string;
  itemId: string | null;
  subtotal: number;
  receiptLineId: string | null;
}

export interface PayablePurchaseReturnInfo {
  id: string;
  code: string;
}

// Lo que cuentas por pagar lee de compras: proveedores y facturas de compra, con lo pagado de cada una.
// En la base el adaptador lee las tablas de compras; el dominio no sabe que existen.
export interface PayablesLedger {
  suppliers(tenantId: TenantId, filter?: PayableSupplierFilter): Promise<PayableSupplier[]>;
  supplier(tenantId: TenantId, supplierId: string): Promise<PayableSupplier | null>;
  // Confirmadas y anuladas, las mas recientes primero. Sin filtro, todas las de la empresa.
  invoices(tenantId: TenantId, filter?: PayableInvoiceFilter): Promise<PayableInvoice[]>;
  invoiceLines(tenantId: TenantId, invoiceId: string): Promise<PayableInvoiceLineInfo[]>;
  returnReceiptLineIds(tenantId: TenantId, returnId: string): Promise<string[]>;
  purchaseReturns(tenantId: TenantId, returnIds: string[]): Promise<PayablePurchaseReturnInfo[]>;
}
