import type { AgingTotals, CustomerBalance, Payment, Receivable, Statement } from './receivables';

export interface PaymentInput {
  customerId: string;
  date: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  currency: string | null;
  exchangeRate: number | null;
  // Cada importe en la moneda de su factura.
  allocations: { invoiceId: string; amount: number }[];
}

// Lo que la API responde en cada listado: la pagina y cuantas filas cumplen el filtro.
export interface Page {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Las fechas filtran por el vencimiento de la factura. Una anulada no se cobra y no se lista.
export type ReceivableFilters = {
  q?: string;
  customerId?: string;
  status?: string;
  from?: string;
  to?: string;
  onlyOverdue?: 'true' | 'false';
  limit?: number;
  offset?: number;
};
// Las fechas filtran por la del cobro.
export type PaymentFilters = { q?: string; customerId?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number };
export type CustomerBalanceFilters = { q?: string; onlyWithBalance?: 'true' | 'false'; limit?: number; offset?: number };

export interface ReceivablePage extends Page {
  receivables: Receivable[];
}

export interface PaymentPage extends Page {
  payments: Payment[];
}

// `totals` suma todo lo que cumple el filtro, no la pagina: es la fila de totales de la pantalla.
export interface CustomerBalancePage extends Page {
  customers: CustomerBalance[];
  totals: AgingTotals;
}

export interface ReceivablesApi {
  searchPayments(token: string, filters?: PaymentFilters): Promise<PaymentPage>;
  savePayment(token: string, id: string | null, input: PaymentInput): Promise<void>;
  confirmPayment(token: string, id: string): Promise<void>;
  cancelPayment(token: string, id: string): Promise<void>;
  searchReceivables(token: string, filters?: ReceivableFilters): Promise<ReceivablePage>;
  // Para los selectores de un cobro: hay que poder elegir cualquier factura, no solo la pagina.
  allReceivables(token: string): Promise<Receivable[]>;
  searchCustomerBalances(token: string, filters?: CustomerBalanceFilters): Promise<CustomerBalancePage>;
  // Para el selector de cliente de los filtros, deban o no.
  allCustomers(token: string): Promise<CustomerBalance['customer'][]>;
  searchStatement(token: string, customerId: string): Promise<Statement>;
}
