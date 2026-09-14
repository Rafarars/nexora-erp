export type PaymentStatus = 'draft' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'check';
export type CollectionStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type AgingBucket = 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'over90';
export type AgingTotals = Record<AgingBucket | 'total', number>;

export interface Payment {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  amount: number;
  status: PaymentStatus;
  allocations: { invoiceId: string; invoiceCode: string; dueDate: string; amount: number }[];
}

export interface Receivable {
  id: string;
  code: string;
  customer: { id: string; code: string; name: string };
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
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
}

export interface Statement {
  summary: CustomerBalance;
  movements: StatementMovement[];
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { draft: 'Borrador', confirmed: 'Confirmado', cancelled: 'Anulado' };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', check: 'Cheque' };

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
