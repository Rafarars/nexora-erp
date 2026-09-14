import { ReportPeriod } from '../period/report-period.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export const REPORTING_READ_MODEL = Symbol('ReportingReadModel');

export interface ReportCustomer {
  id: string;
  code: string;
  name: string;
  fiscalId: string | null;
  paymentTermDays: number;
  creditLimit: number | null;
}

// Una factura emitida con lo cobrado por cobros confirmados.
export interface ReportInvoice {
  id: string;
  code: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
}

export interface ReportStatementEntry {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  amount: number;
}

export interface ReportCustomerSales {
  customerId: string;
  invoices: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface ReportItemSales {
  itemId: string;
  sku: string;
  name: string;
  subtotal: number;
}

export interface ReportStock {
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  sku: string;
  name: string;
  baseUnit: string;
  quantity: number;
  averageCost: number;
}

// Todo lo que los reportes leen de los demas modulos, siempre de una empresa. Solo lectura: en la
// base el adaptador consulta las tablas de ventas, compras, cobranza e inventario.
export interface ReportingReadModel {
  companyName(tenantId: TenantId): Promise<string>;
  customers(tenantId: TenantId): Promise<ReportCustomer[]>;
  warehouseExists(tenantId: TenantId, warehouseId: string): Promise<boolean>;
  // Emitidas, con saldo o sin el; filtro opcional por cliente.
  issuedInvoices(tenantId: TenantId, customerId?: string): Promise<ReportInvoice[]>;
  statementEntries(tenantId: TenantId, customerId: string): Promise<ReportStatementEntry[]>;
  salesTotal(tenantId: TenantId, period: ReportPeriod): Promise<number>;
  // Lo recibido en entradas confirmadas, a su costo y sin impuesto.
  purchasesTotal(tenantId: TenantId, period: ReportPeriod): Promise<number>;
  collectedTotal(tenantId: TenantId, period: ReportPeriod): Promise<number>;
  salesByCustomer(tenantId: TenantId, period: ReportPeriod): Promise<ReportCustomerSales[]>;
  salesByItem(tenantId: TenantId, period: ReportPeriod): Promise<ReportItemSales[]>;
  // Existencias distintas de cero, filtro opcional por bodega.
  stock(tenantId: TenantId, warehouseId?: string): Promise<ReportStock[]>;
}
