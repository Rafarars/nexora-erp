import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
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
