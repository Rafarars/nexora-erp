import type { AgingTotals, CustomerBalance, Payment, Receivable, Statement } from './receivables';

export interface PaymentInput {
  customerId: string;
  date: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  allocations: { invoiceId: string; amount: number }[];
}

export interface ReceivablesApi {
  searchPayments(token: string): Promise<Payment[]>;
  savePayment(token: string, id: string | null, input: PaymentInput): Promise<void>;
  confirmPayment(token: string, id: string): Promise<void>;
  cancelPayment(token: string, id: string): Promise<void>;
  searchReceivables(token: string): Promise<Receivable[]>;
  searchCustomerBalances(token: string): Promise<{ customers: CustomerBalance[]; totals: AgingTotals }>;
  searchStatement(token: string, customerId: string): Promise<Statement>;
}
