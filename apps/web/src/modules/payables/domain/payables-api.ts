import type { AgingTotals, PayableInvoice, Statement, SupplierBalance, SupplierPayment } from './payables';

export interface PaymentInput {
  supplierId: string;
  date: string | null;
  method: string;
  creditSourceId?: string | null;
  reference: string | null;
  notes: string | null;
  currency: string | null;
  exchangeRate: number | null;
  // Cada importe en la moneda de su factura
  allocations: { invoiceId: string; amount: number }[];
}

export interface Page {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type PaymentFilters = {
  q?: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type PayableInvoiceFilters = {
  q?: string;
  supplierId?: string;
  status?: string;
  from?: string;
  to?: string;
  onlyOverdue?: 'true' | 'false';
  limit?: number;
  offset?: number;
};

export type SupplierBalanceFilters = {
  q?: string;
  onlyWithBalance?: 'true' | 'false';
  limit?: number;
  offset?: number;
};

export interface PaymentPage extends Page {
  payments: SupplierPayment[];
}

export interface PayableInvoicePage extends Page {
  invoices: PayableInvoice[];
}

export interface SupplierBalancePage extends Page {
  suppliers: SupplierBalance[];
  totals: AgingTotals;
}

export interface PayablesApi {
  searchPayments(token: string, filters?: PaymentFilters): Promise<PaymentPage>;
  savePayment(token: string, id: string | null, input: PaymentInput): Promise<void>;
  confirmPayment(token: string, id: string): Promise<void>;
  cancelPayment(token: string, id: string): Promise<void>;
  searchPayableInvoices(token: string, filters?: PayableInvoiceFilters): Promise<PayableInvoicePage>;
  allInvoices(token: string): Promise<PayableInvoice[]>;
  searchSupplierBalances(token: string, filters?: SupplierBalanceFilters): Promise<SupplierBalancePage>;
  allSuppliers(token: string): Promise<SupplierBalance['supplier'][]>;
  searchStatement(token: string, supplierId: string): Promise<Statement>;
}
