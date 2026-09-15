import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  DuplicatePaymentInvoiceError,
  EmptyPaymentError,
  InvalidPaymentMethodError,
  PaymentAlreadyCancelledError,
  PaymentNotConfirmableError,
  PaymentNotEditableError,
  ReceivableInvoiceNotFoundError,
} from '../errors/receivables.errors.js';
import { ReceivableInvoice } from '../ledger/receivable-invoice.js';
import { centsToNumber, paymentCents, toCents } from '../shared/amount.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class PaymentId extends Uuid {
  static of(value: string): PaymentId {
    return new PaymentId(value);
  }
}

export const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'check'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentStatus = 'draft' | 'confirmed' | 'cancelled';

export interface PaymentAllocationPrimitives {
  id: string;
  invoiceId: string;
  amount: number;
}

export interface PaymentPrimitives {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  amount: number;
  status: PaymentStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  allocations: PaymentAllocationPrimitives[];
}

export interface PaymentDetails {
  customerId: string;
  date: ReceivablesDate;
  method: string;
  reference?: string | null;
  notes?: string | null;
  allocations: PaymentAllocationPrimitives[];
}

type Body = Pick<PaymentPrimitives, 'customerId' | 'paymentDate' | 'method' | 'reference' | 'notes' | 'amount' | 'allocations'>;

// Un cobro de un cliente, repartido entre sus facturas. En borrador no toca ningun saldo;
// confirmado, baja el de cada factura en lo que le aplica; anulado, lo devuelve. El importe del
// cobro es la suma de lo aplicado: aqui no hay anticipos ni pagos de mas.
export class CustomerPayment {
  private constructor(private row: PaymentPrimitives) {}

  static draft(id: PaymentId, tenantId: TenantId, code: string, details: PaymentDetails, now: Date, today: string): CustomerPayment {
    return new CustomerPayment({
      id: id.value,
      tenantId: tenantId.value,
      code,
      ...validated(details, today),
      status: 'draft',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPrimitives(row: PaymentPrimitives): CustomerPayment {
    return new CustomerPayment(structuredClone(row));
  }

  toPrimitives(): PaymentPrimitives {
    return structuredClone(this.row);
  }

  get id(): PaymentId {
    return PaymentId.of(this.row.id);
  }

  get code(): string {
    return this.row.code;
  }

  customerId(): string {
    return this.row.customerId;
  }

  currentStatus(): PaymentStatus {
    return this.row.status;
  }

  invoiceIds(): string[] {
    return this.row.allocations.map((allocation) => allocation.invoiceId);
  }

  update(details: PaymentDetails, now: Date, today: string): void {
    if (this.row.status !== 'draft') throw new PaymentNotEditableError(this.row.id, this.row.status);

    this.row = { ...this.row, ...validated(details, today), updatedAt: now };
  }

  // Cada factura, con lo que ya le cobraron OTROS cobros, tiene que aceptar lo que este le aplica.
  ensureFits(invoices: ReceivableInvoice[]): void {
    const date = ReceivablesDate.of(this.row.paymentDate);

    for (const allocation of this.row.allocations) {
      const invoice = invoices.find((candidate) => candidate.id === allocation.invoiceId);

      if (!invoice) throw new ReceivableInvoiceNotFoundError(allocation.invoiceId);

      invoice.ensureAccepts(this.row.customerId, date, toCents(allocation.amount));
    }
  }

  confirm(invoices: ReceivableInvoice[], now: Date, today: string): void {
    if (this.row.status !== 'draft') throw new PaymentNotConfirmableError(this.row.id, this.row.status);

    ReceivablesDate.of(this.row.paymentDate).ensureNotAfter(today);
    this.ensureFits(invoices);

    this.row = { ...this.row, status: 'confirmed', confirmedAt: now, updatedAt: now };
  }

  // Anular un confirmado devuelve el saldo a sus facturas; anular un borrador solo lo descarta.
  cancel(now: Date): void {
    if (this.row.status === 'cancelled') throw new PaymentAlreadyCancelledError(this.row.id);

    this.row = { ...this.row, status: 'cancelled', cancelledAt: now, updatedAt: now };
  }
}

function validated(details: PaymentDetails, today: string): Body {
  if (!PAYMENT_METHODS.includes(details.method as PaymentMethod)) throw new InvalidPaymentMethodError(details.method);
  if (details.allocations.length === 0) throw new EmptyPaymentError();

  details.date.ensureNotAfter(today);

  const seen = new Set<string>();
  const allocations = details.allocations.map((allocation) => {
    if (seen.has(allocation.invoiceId)) throw new DuplicatePaymentInvoiceError(allocation.invoiceId);

    seen.add(allocation.invoiceId);

    return { id: allocation.id, invoiceId: allocation.invoiceId, cents: paymentCents(allocation.amount) };
  });

  return {
    customerId: details.customerId,
    paymentDate: details.date.value,
    method: details.method as PaymentMethod,
    reference: optionalText(details.reference, 100, 'PaymentReference'),
    notes: optionalText(details.notes, 500, 'PaymentNotes'),
    amount: centsToNumber(allocations.reduce((sum, allocation) => sum + allocation.cents, 0n)),
    allocations: allocations.map(({ cents, ...allocation }) => ({ ...allocation, amount: centsToNumber(cents) })),
  };
}
