import { DocumentCurrencyPrimitives } from '../../../shared/domain/document-currency.js';
import { ReportCustomer, ReportingReadModel } from '../domain/read-model/reporting-read-model.js';

// Sin monedas, el documento va en la de la empresa, como lo anterior al multimoneda.
export type SeedCurrency = Partial<DocumentCurrencyPrimitives>;

export interface SeedInvoice extends SeedCurrency {
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

export interface SeedPayment extends SeedCurrency {
  code: string;
  customerId: string;
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  // En la moneda del cobro; por defecto, la suma de lo aplicado.
  amount?: number;
  // Cada aplicacion, en la moneda de su factura.
  allocations: { invoiceId: string; amount: number }[];
}

export interface SeedReceipt extends SeedCurrency {
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  warehouseId: string;
  lines: { itemId: string; quantity: number; unitCost: number }[];
}

// Siembra lo que en la base escriben los demas modulos, en su forma original: facturas con su
// estado, cobros con sus aplicaciones, entradas con sus lineas. El modelo de lectura resume.
export interface ReportingReadModelHarness {
  readModel(): ReportingReadModel;
  // El nombre con que se registro y, si se da, los datos que la empresa lleno.
  company(tenantId: string, name: string, profile?: { legalName: string; fiscalId: string | null }): Promise<void>;
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
