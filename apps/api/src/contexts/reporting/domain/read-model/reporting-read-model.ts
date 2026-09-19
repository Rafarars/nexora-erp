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

// Una factura emitida con lo cobrado por cobros confirmados, todo en la moneda de la empresa.
export interface ReportInvoice {
  id: string;
  code: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  // Total menos cobrado, convertido y redondeado de una vez: es lo que suman saldos y antiguedad.
  balance: number;
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
// Los importes llegan **en la moneda de la empresa**: cada documento se convierte con las dos tasas
// que congelo y se redondea a `decimals`, los decimales de importe de la empresa.
// Quien emite el reporte: la razon social y el RIF de sus datos, o el nombre con que se registro.
export interface ReportCompany {
  name: string;
  fiscalId: string | null;
}

export interface ReportingReadModel {
  company(tenantId: TenantId): Promise<ReportCompany>;
  customers(tenantId: TenantId): Promise<ReportCustomer[]>;
  // El nombre, no un si o un no: el PDF lo necesita aunque la bodega este vacia.
  warehouseNamed(tenantId: TenantId, warehouseId: string): Promise<string | null>;
  // Emitidas, con saldo o sin el; filtro opcional por cliente.
  issuedInvoices(tenantId: TenantId, decimals: number, customerId?: string): Promise<ReportInvoice[]>;
  statementEntries(tenantId: TenantId, customerId: string, decimals: number): Promise<ReportStatementEntry[]>;
  salesTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number>;
  // Lo recibido en entradas confirmadas, a su costo y sin impuesto.
  purchasesTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number>;
  collectedTotal(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<number>;
  salesByCustomer(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<ReportCustomerSales[]>;
  salesByItem(tenantId: TenantId, period: ReportPeriod, decimals: number): Promise<ReportItemSales[]>;
  // Existencias distintas de cero, filtro opcional por bodega. El costo promedio ya esta en la
  // moneda de la empresa: no se convierte.
  stock(tenantId: TenantId, warehouseId?: string): Promise<ReportStock[]>;
}
