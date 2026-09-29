import type { PurchaseInvoiceId } from '../../contexts/payables/domain/shared/purchase-invoice-id.vo.js';
import type { SupplierId } from '../../contexts/payables/domain/shared/supplier-id.vo.js';
import type { TenantId } from '../../contexts/payables/domain/shared/tenant-id.vo.js';

export const PAYABLE_BALANCES = Symbol('PayableBalances');

export interface AgingTotals {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
}

// Exposición de un proveedor calculada a partir de sus facturas confirmadas y pagos aplicados.
export interface SupplierExposure {
  openBalance: number;
  hasOverdue: boolean;
  overdueBalance: number;
  aging: AgingTotals;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface ReportPayableInvoice {
  id: string;
  code: string;
  supplierId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
}

export type TenantIdRef = TenantId | string | { value: string };
export type SupplierIdRef = SupplierId | string | { value: string };
export type PurchaseInvoiceIdRef = PurchaseInvoiceId | string | { value: string };

// El único sitio del sistema que resta lo pagado de lo facturado. Reporting y contabilidad lo
// consumen por aquí; si aparece una segunda resta en una consulta, está mal (H9 §3.8 y §5.3).
export interface PayableBalances {
  ofSupplier(tenantId: TenantIdRef, supplierId: SupplierIdRef): Promise<SupplierExposure>;
  ofInvoice(tenantId: TenantIdRef, invoiceId: PurchaseInvoiceIdRef): Promise<Money>;
  allInvoices(tenantId: TenantIdRef, decimals: number): Promise<ReportPayableInvoice[]>;
  totalBalance(tenantId: TenantIdRef, decimals: number): Promise<number>;
}
