import { ReceivableInvoice } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer } from '../../domain/ledger/receivables-ledger.js';
import { CustomerPayment, PaymentStatus } from '../../domain/payment/customer-payment.entity.js';

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
  method: 'cash' | 'transfer' | 'card' | 'check';
  reference: string | null;
  notes: string | null;
  amount: Decimalish;

  currency: string;
  exchangeRate: Decimalish | null;
  baseCurrency: string;
  baseExchangeRate: Decimalish | null;
  manualExchangeRate: boolean;
  amountVes: Decimalish | null;
  status: PaymentStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: { id: string; invoiceId: string; amount: Decimalish; exchangeDifference: Decimalish }[];
}

export function paymentFromRow(row: PaymentRow): CustomerPayment {
  return CustomerPayment.fromPrimitives({
    ...row,
    paymentDate: day(row.paymentDate),
    amount: row.amount.toNumber(),
    exchangeRate: row.exchangeRate ? row.exchangeRate.toNumber() : null,
    baseExchangeRate: row.baseExchangeRate ? row.baseExchangeRate.toNumber() : null,
    amountVes: row.amountVes ? row.amountVes.toNumber() : null,
    allocations: row.allocations.map((allocation) => ({ id: allocation.id, invoiceId: allocation.invoiceId, amount: allocation.amount.toNumber(), exchangeDifference: allocation.exchangeDifference.toNumber() })),
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
    exchangeRate: true,
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
  exchangeRate: Decimalish | null;
  allocations: { amount: Decimalish }[];
}): ReceivableInvoice {
  const paidBase = row.allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount.toNumber() * 10000), 0);

  return ReceivableInvoice.of({
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    issueDate: day(row.issueDate),
    dueDate: day(row.dueDate),
    status: row.status,
    total: row.total.toNumber(),
    exchangeRate: row.exchangeRate ? row.exchangeRate.toNumber() : null,
    paid: paidBase / 10000,
  });
}
