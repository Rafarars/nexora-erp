import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer } from '../../domain/ledger/receivables-ledger.js';
import { CustomerCreditNote, CreditNoteReason } from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerPayment, PaymentMethod, PaymentStatus } from '../../domain/payment/customer-payment.entity.js';

type Decimalish = { toNumber(): number };

// Prisma devuelve decimal como objetos Decimal y fechas sin hora como Date a medianoche UTC.
const day = (value: Date) => value.toISOString().slice(0, 10);

export const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const PAYMENT_INCLUDE = { allocations: { orderBy: { id: 'asc' } } } as const;

export interface PaymentRow {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  paymentDate: Date;
  method: PaymentMethod;
  creditSourceId: string | null;
  reference: string | null;
  notes: string | null;
  amount: Decimalish;
  amountVes: Decimalish | null;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  status: PaymentStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: { id: string; invoiceId: string; amount: Decimalish; exchangeRate: Decimalish | null; exchangeDifference: Decimalish | null }[];
}

const decimalOrNull = (value: Decimalish | null) => (value === null ? null : value.toNumber());

export function paymentFromRow(row: PaymentRow): CustomerPayment {
  return CustomerPayment.fromPrimitives({
    ...row,
    paymentDate: day(row.paymentDate),
    amount: row.amount.toNumber(),
    amountVes: decimalOrNull(row.amountVes),
    exchangeRate: decimalOrNull(row.exchangeRate),
    baseExchangeRate: decimalOrNull(row.baseExchangeRate),
    allocations: row.allocations.map((allocation) => ({
      id: allocation.id,
      invoiceId: allocation.invoiceId,
      amount: allocation.amount.toNumber(),
      exchangeRate: decimalOrNull(allocation.exchangeRate),
      exchangeDifference: decimalOrNull(allocation.exchangeDifference),
    })),
  });
}

export function customerFromRow(row: { id: string; code: string; name: string; paymentTermDays: number; creditLimit: Decimalish | null; isActive: boolean }): ReceivableCustomer {
  return { ...row, creditLimit: row.creditLimit === null ? null : row.creditLimit.toNumber() };
}

// Lo cobrado de cada factura: solo cuentan los cobros confirmados, y nunca el que se esta publicando.
export function invoiceSelect(excludedPayment?: string) {
  return {
    id: true,
    code: true,
    customerId: true,
    issueDate: true,
    dueDate: true,
    status: true,
    total: true,
    currency: true,
    exchangeRate: true,
    baseCurrency: true,
    baseExchangeRate: true,
    manualExchangeRate: true,
    allocations: {
      where: { payment: { status: 'confirmed' as const, ...(excludedPayment ? { id: { not: excludedPayment } } : {}) } },
      select: { amount: true },
    },
  };
}

export function invoiceFromRow(row: {
  id: string;
  code: string;
  customerId: string;
  issueDate: Date;
  dueDate: Date;
  status: 'issued' | 'cancelled';
  total: Decimalish;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  allocations: { amount: Decimalish }[];
}): ReceivableInvoice {
  const paid = row.allocations.reduce((sum, allocation) => sum + amountUnits(allocation.amount.toNumber()), 0n);

  return ReceivableInvoice.of({
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    issueDate: day(row.issueDate),
    dueDate: day(row.dueDate),
    status: row.status,
    total: row.total.toNumber(),
    currency: row.currency,
    exchangeRate: decimalOrNull(row.exchangeRate),
    baseCurrency: row.baseCurrency,
    baseExchangeRate: decimalOrNull(row.baseExchangeRate),
    manualExchangeRate: row.manualExchangeRate,
    paid: unitsToNumber(paid),
  });
}

export const CREDIT_NOTE_INCLUDE = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const;

export interface CreditNoteRow {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  invoiceId: string | null;
  salesReturnId: string | null;
  issuePaymentId: string | null;
  issueDate: Date;
  reason: CreditNoteReason;
  reasonDetail: string | null;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: Decimalish;
  tax: Decimalish;
  total: Decimalish;
  subtotalVes: Decimalish | null;
  taxVes: Decimalish | null;
  totalVes: Decimalish | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  lines: {
    id: string;
    lineNumber: number;
    itemId: string | null;
    itemSku: string | null;
    itemName: string | null;
    concept: string | null;
    unitId: string | null;
    quantity: Decimalish;
    unitPrice: Decimalish;
    taxRate: Decimalish;
    subtotal: Decimalish;
    tax: Decimalish;
    total: Decimalish;
  }[];
}

export function creditNoteFromRow(row: CreditNoteRow): CustomerCreditNote {
  return CustomerCreditNote.fromPrimitives({
    ...row,
    issueDate: day(row.issueDate),
    subtotal: row.subtotal.toNumber(),
    tax: row.tax.toNumber(),
    total: row.total.toNumber(),
    subtotalVes: decimalOrNull(row.subtotalVes),
    taxVes: decimalOrNull(row.taxVes),
    totalVes: decimalOrNull(row.totalVes),
    exchangeRate: decimalOrNull(row.exchangeRate),
    baseExchangeRate: decimalOrNull(row.baseExchangeRate),
    lines: row.lines.map((l) => ({
      id: l.id,
      lineNumber: l.lineNumber,
      itemId: l.itemId,
      itemSku: l.itemSku,
      itemName: l.itemName,
      concept: l.concept,
      unitId: l.unitId,
      quantity: l.quantity.toNumber(),
      unitPrice: l.unitPrice.toNumber(),
      taxRate: l.taxRate.toNumber(),
      subtotal: l.subtotal.toNumber(),
      tax: l.tax.toNumber(),
      total: l.total.toNumber(),
    })),
  });
}

