import { ReportCustomer, ReportingReadModel } from '../domain/read-model/reporting-read-model.js';

export interface SeedInvoice {
  id: string;
  code: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  status: 'issued' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  lines: { itemId: string; subtotal: number }[];
}

export interface SeedPayment {
  code: string;
  customerId: string;
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  allocations: { invoiceId: string; amount: number }[];
}

export interface SeedReceipt {
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  warehouseId: string;
  lines: { itemId: string; quantity: number; unitCost: number }[];
}

// Siembra lo que en la base escriben los demas modulos, en su forma original: facturas con su
// estado, cobros con sus aplicaciones, entradas con sus lineas. El modelo de lectura resume.
export interface ReportingReadModelHarness {
  readModel(): ReportingReadModel;
  company(tenantId: string, name: string): Promise<void>;
  customer(tenantId: string, customer: ReportCustomer): Promise<void>;
  warehouse(tenantId: string, warehouse: { id: string; name: string }): Promise<void>;
  item(tenantId: string, item: { id: string; sku: string; name: string; baseUnit: string }): Promise<void>;
  invoice(tenantId: string, invoice: SeedInvoice): Promise<void>;
  payment(tenantId: string, payment: SeedPayment): Promise<void>;
  receipt(tenantId: string, receipt: SeedReceipt): Promise<void>;
  stock(tenantId: string, stock: { itemId: string; warehouseId: string; quantity: number; averageCost: number }): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}
