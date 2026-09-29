import type { DocumentCurrency } from '../../company/domain/company';

export type PaymentStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'check' | 'credit_note';
export type PayableStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type AgingBucket = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'over90';
export type AgingTotals = Record<AgingBucket | 'total', number>;

export interface SupplierPaymentAllocation {
  invoiceId: string;
  invoiceCode: string;
  dueDate: string;
  currency: string;
  amount: number;
  exchangeRate: number | null;
  exchangeDifference: number | null;
}

export interface SupplierPayment extends DocumentCurrency {
  id: string;
  code: string;
  supplier: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  creditSourceId?: string | null;
  creditSourceCode?: string | null;
  reference: string | null;
  notes: string | null;
  isIssuePayment?: boolean;
  issueCreditNoteCode?: string | null;
  // En la moneda del pago
  amount: number;
  amountVes: number | null;
  status: PaymentStatus;
  // Cada importe en la moneda de su factura; el diferencial cambiario, en bolivares
  allocations: SupplierPaymentAllocation[];
}

export interface PayableInvoice {
  id: string;
  code: string;
  supplier: { id: string; code: string; name: string };
  issueDate: string;
  dueDate: string;
  currency: string;
  total: number;
  paid: number;
  balance: number;
  companyBalance: number;
  status: PayableStatus;
}

export interface SupplierBalance {
  supplier: { id: string; code: string; name: string; fiscalId: string | null };
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
}

export interface SupplierAvailableCredit {
  id: string;
  code: string;
  issueDate: string;
  total: number;
  appliedAmount: number;
  availableCredit: number;
  currency: string;
  exchangeRate: number;
  notes: string | null;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Anulado',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit_note: 'Nota de crédito',
};

export function paymentActions(payment: SupplierPayment, canUpdate: boolean, canConfirm: boolean, canCancel: boolean) {
  return {
    canEdit: payment.status === 'draft' && canUpdate,
    canConfirm: payment.status === 'draft' && canConfirm,
    canCancel: payment.status === 'confirmed' && canCancel && !payment.isIssuePayment,
  };
}

export function payableInvoices(invoices: PayableInvoice[], supplierId: string): PayableInvoice[] {
  return invoices.filter((invoice) => invoice.supplier.id === supplierId && invoice.balance > 0);
}
