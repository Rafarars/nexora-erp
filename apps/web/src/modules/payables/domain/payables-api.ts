import type {
  AgingTotals,
  CreditNoteReason,
  PayableInvoice,
  Statement,
  SupplierAvailableCredit,
  SupplierBalance,
  SupplierCreditNote,
  SupplierPayment,
} from './payables';

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

export interface CreditNoteLineInput {
  id?: string;
  invoiceLineId?: string | null;
  itemId?: string | null;
  itemSku?: string | null;
  itemName?: string | null;
  concept?: string | null;
  unitId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CreditNoteInput {
  supplierId: string;
  invoiceId?: string | null;
  purchaseReturnId?: string | null;
  date: string | null;
  reason: CreditNoteReason;
  reasonDetail?: string | null;
  notes?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  lines: CreditNoteLineInput[];
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

export type CreditNoteFilters = {
  q?: string;
  supplierId?: string;
  invoiceId?: string;
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

export interface CreditNotePage extends Page {
  creditNotes: SupplierCreditNote[];
}

export interface PayableInvoicePage extends Page {
  invoices: PayableInvoice[];
}

export interface SupplierBalancePage extends Page {
  suppliers: SupplierBalance[];
  totals: AgingTotals;
}

export interface EligiblePurchaseReturnLine {
  id: string;
  receiptLineId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  unitId: string;
  concept: string;
  quantity: number;
  unitCost: number;
  invoiceLineId?: string | null;
  invoicedUnitPrice?: number | null;
}

export interface EligiblePurchaseReturn {
  id: string;
  code: string;
  date: string;
  lines: EligiblePurchaseReturnLine[];
}

export interface PayablesApi {
  searchPayments(token: string, filters?: PaymentFilters): Promise<PaymentPage>;
  savePayment(token: string, id: string | null, input: PaymentInput): Promise<void>;
  confirmPayment(token: string, id: string): Promise<void>;
  cancelPayment(token: string, id: string): Promise<void>;
  searchCreditNotes(token: string, filters?: CreditNoteFilters): Promise<CreditNotePage>;
  saveCreditNote(token: string, id: string | null, input: CreditNoteInput): Promise<void>;
  confirmCreditNote(token: string, id: string): Promise<void>;
  cancelCreditNote(token: string, id: string): Promise<void>;
  availableCredits(token: string, supplierId: string): Promise<SupplierAvailableCredit[]>;
  eligiblePurchaseReturns(token: string, invoiceId: string): Promise<EligiblePurchaseReturn[]>;
  searchPayableInvoices(token: string, filters?: PayableInvoiceFilters): Promise<PayableInvoicePage>;
  allInvoices(token: string): Promise<PayableInvoice[]>;
  searchSupplierBalances(token: string, filters?: SupplierBalanceFilters): Promise<SupplierBalancePage>;
  allSuppliers(token: string): Promise<SupplierBalance['supplier'][]>;
  searchStatement(token: string, supplierId: string): Promise<Statement>;
}
