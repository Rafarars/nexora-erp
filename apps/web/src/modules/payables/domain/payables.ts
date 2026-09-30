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

export type CreditNoteStatus = 'draft' | 'confirmed' | 'cancelled';

export const CREDIT_NOTE_REASONS = [
  'return',
  'subsequent_discount',
  'price_correction',
  'damaged_goods',
  'cancellation',
  'other',
] as const;

export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number];

export const CREDIT_NOTE_REASON_LABELS: Record<CreditNoteReason, string> = {
  return: 'Devolución de mercancía',
  subsequent_discount: 'Descuento posterior',
  price_correction: 'Corrección de precio',
  damaged_goods: 'Mercancía dañada',
  cancellation: 'Anulación de factura',
  other: 'Otro motivo',
};

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  cancelled: 'Anulada',
};

export interface SupplierCreditNoteLine {
  id: string;
  lineNumber: number;
  invoiceLineId?: string | null;
  itemId: string | null;
  itemSku: string | null;
  itemName: string | null;
  concept: string | null;
  unitId: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface SupplierCreditNote {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  invoice: { id: string; code: string } | null;
  purchaseReturnId: string | null;
  purchaseReturn?: { id: string; code: string } | null;
  purchaseReturnCode?: string | null;
  issuePaymentId: string | null;
  issuePaymentCode?: string | null;
  issueDate: string;
  reason: CreditNoteReason;
  reasonDetail: string | null;
  notes: string | null;
  status: CreditNoteStatus;
  subtotal: number;
  tax: number;
  total: number;
  currency: {
    code: string;
    symbol: string;
    exchangeRate: number | null;
  };
  appliedAmount: number;
  availableCredit: number;
  priceDifference: number;
  exchangeDifference: number;
  lines: SupplierCreditNoteLine[];
}

export function creditNoteActions(
  note: SupplierCreditNote,
  canUpdate: boolean,
  canConfirm: boolean,
  canCancel: boolean,
) {
  return {
    canEdit: note.status === 'draft' && canUpdate,
    canConfirm: note.status === 'draft' && canConfirm,
    canCancel: note.status === 'confirmed' && canCancel,
  };
}

export interface AvailableCredit {
  id: string;
  code: string;
  currency: string;
  total: number;
  appliedAmount: number;
  availableCredit: number;
}

// Agrupa el credito disponible por moneda sin convertir para no mezclar importes nominales.
export function summarizeAvailableCredits(
  credits: AvailableCredit[],
  baseCurrency: string,
  format: (amount: number) => string = (n) => n.toFixed(2),
): string {
  if (credits.length === 0) return `${baseCurrency} ${format(0)}`;

  const byCurrency = new Map<string, number>();
  for (const credit of credits) {
    if (credit.availableCredit <= 0) continue;
    const current = byCurrency.get(credit.currency) ?? 0;
    byCurrency.set(credit.currency, current + credit.availableCredit);
  }

  if (byCurrency.size === 0) return `${baseCurrency} ${format(0)}`;

  return [...byCurrency.entries()]
    .map(([currency, total]) => `${currency} ${format(total)}`)
    .join(' · ');
}
