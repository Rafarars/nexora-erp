import type { DocumentCurrency } from '../../company/domain/company';

export type PaymentStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'check' | 'credit_note';
export type CollectionStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type AgingBucket = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'over90';
export type AgingTotals = Record<AgingBucket | 'total', number>;

export interface Payment extends DocumentCurrency {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  creditSourceId?: string | null;
  reference: string | null;
  notes: string | null;
  // En la moneda del cobro.
  amount: number;
  amountVes: number | null;
  status: PaymentStatus;
  // Cada importe en la moneda de su factura; el diferencial cambiario, en bolivares.
  allocations: { invoiceId: string; invoiceCode: string; dueDate: string; currency: string; amount: number; exchangeRate: number | null; exchangeDifference: number | null }[];
}

export type CreditNoteStatus = 'draft' | 'confirmed' | 'cancelled';
export const CREDIT_NOTE_REASONS = ['return', 'subsequent_discount', 'price_correction', 'damaged_goods', 'cancellation', 'other'] as const;
export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number];

export interface CreditNoteLine {
  id: string;
  lineNumber: number;
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

export interface CreditNote {
  id: string;
  code: string;
  customer: { id: string; name: string };
  invoice: { id: string; code: string } | null;
  salesReturnId: string | null;
  issuePaymentId: string | null;
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
  lines: CreditNoteLine[];
}

export interface AvailableCredit {
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

export interface Receivable {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  issueDate: string;
  dueDate: string;
  // En la moneda de la factura.
  currency: string;
  total: number;
  paid: number;
  balance: number;
  // En la moneda de la empresa.
  companyBalance: number;
  status: CollectionStatus;
  daysOverdue: number;
  bucket: AgingBucket | null;
}

export interface CustomerBalance {
  customer: { id: string; code: string; name: string; isActive: boolean };
  paymentTermDays: number;
  creditLimit: number | null;
  balance: number;
  overdue: number;
  availableCredit: number | null;
  creditBlocked: boolean;
  aging: AgingTotals;
}

export interface StatementMovement {
  date: string;
  type: 'invoice' | 'payment';
  code: string;
  debit: number;
  credit: number;
  balance: number;
  // De un cobro, en bolivares.
  exchangeDifference: number | null;
}

export interface Statement {
  summary: CustomerBalance;
  movements: StatementMovement[];
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { draft: 'Borrador', confirmed: 'Confirmado', cancelled: 'Anulado' };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  credit_note: 'Nota de crédito',
};

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  cancelled: 'Anulada',
};

export const CREDIT_NOTE_REASON_LABELS: Record<CreditNoteReason, string> = {
  return: 'Devolución de mercancía',
  subsequent_discount: 'Descuento posterior',
  price_correction: 'Corrección de precio',
  damaged_goods: 'Mercancía dañada',
  cancellation: 'Anulación de operación',
  other: 'Otro motivo',
};

export function creditNoteActions(note: Pick<CreditNote, 'status'>): { edit: boolean; confirm: boolean; cancel: boolean } {
  return { edit: note.status === 'draft', confirm: note.status === 'draft', cancel: note.status !== 'cancelled' };
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  pending: 'Pendiente',
  partially_paid: 'Cobrada en parte',
  paid: 'Cobrada',
  cancelled: 'Anulada',
};

export const AGING_COLUMNS: { bucket: AgingBucket; label: string }[] = [
  { bucket: 'current', label: 'Por vencer' },
  { bucket: 'days1To30', label: '1 a 30 días' },
  { bucket: 'days31To60', label: '31 a 60 días' },
  { bucket: 'days61To90', label: '61 a 90 días' },
  { bucket: 'over90', label: 'Más de 90 días' },
];

// Lo que la interfaz ofrece en cada estado; la API lo vuelve a comprobar.
export function paymentActions(payment: Pick<Payment, 'status'>): { edit: boolean; confirm: boolean; cancel: boolean } {
  return { edit: payment.status === 'draft', confirm: payment.status === 'draft', cancel: payment.status !== 'cancelled' };
}

export function overdueLabel(days: number): string {
  if (days === 0) return 'Al día';

  return days === 1 ? 'Vencida hace 1 día' : `Vencida hace ${days} días`;
}

// A quien se le puede cobrar: los clientes con alguna factura que deba, mas el del borrador.
export function customersWithDebt(receivables: Receivable[], payment: Payment | null): { id: string; name: string }[] {
  const customers = new Map(receivables.filter((row) => row.balance > 0).map((row) => [row.customer.id, row.customer.name]));

  if (payment) customers.set(payment.customer.id, payment.customer.name);

  return [...customers.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Las facturas que un cobro puede pagar: las del cliente que deben algo y, al editar un
// borrador, las que ya lleva. Las que vencen antes van primero.
export function payableInvoices(receivables: Receivable[], customerId: string, payment: Payment | null): { invoice: Receivable; amount: number | null }[] {
  return receivables
    .filter((row) => row.customer.id === customerId)
    .map((invoice) => ({ invoice, amount: payment?.allocations.find((allocation) => allocation.invoiceId === invoice.id)?.amount ?? null }))
    .filter(({ invoice, amount }) => invoice.balance > 0 || amount !== null)
    .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate) || a.invoice.code.localeCompare(b.invoice.code));
}

export function creditLabel(creditLimit: number | null, format: (value: number) => string): string {
  return creditLimit === null ? 'Sin límite' : format(creditLimit);
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

