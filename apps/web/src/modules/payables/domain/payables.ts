import type { DocumentCurrency } from '../../company/domain/company';

export type PaymentStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'check' | 'credit_note';
export type PayableStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type AgingBucket = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'over90';
export type AgingTotals = Record<AgingBucket | 'total', number>;

export const AGING_COLUMNS: { bucket: AgingBucket; label: string }[] = [
  { bucket: 'current', label: 'Por vencer' },
  { bucket: 'days1To30', label: '1 a 30 días' },
  { bucket: 'days31To60', label: '31 a 60 días' },
  { bucket: 'days61To90', label: '61 a 90 días' },
  { bucket: 'over90', label: 'Más de 90 días' },
];

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
  daysOverdue: number;
  bucket: AgingBucket | null;
}

export interface SupplierBalance {
  supplier: { id: string; code: string; name: string; isActive: boolean };
  paymentTermDays: number;
  balance: number;
  overdue: number;
  aging: AgingTotals;
}

export interface StatementMovement {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  debit: number;
  credit: number;
  balance: number;
  exchangeDifference: number | null;
}

export interface Statement {
  summary: SupplierBalance;
  movements: StatementMovement[];
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

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending: 'Pendiente',
  partially_paid: 'Abonada',
  paid: 'Pagada',
  cancelled: 'Anulada',
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

export function overdueLabel(days: number): string {
  if (days <= 0) return 'Al día';
  if (days === 1) return 'Vencida hace 1 día';
  return `Vencida hace ${days} días`;
}
