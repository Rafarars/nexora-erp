import { roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import { DocumentCurrency, DocumentCurrencyPrimitives, rateUnits } from '../../../../shared/domain/document-currency.js';
import { MissingExchangeRateError } from '../../../../shared/domain/ports/document-rates.js';
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
import { paymentUnits } from '../shared/amount.js';
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
  // En la moneda de la factura: lo que rebaja de su deuda.
  amount: number;
  // Bolivares por 1 unidad de la moneda de la factura el dia del cobro.
  exchangeRate: number | null;
  // En bolivares: lo cobrado a la tasa del cobro menos lo facturado a la tasa de la factura. Null en
  // una factura anterior a las tasas.
  exchangeDifference: number | null;
}

export interface PaymentPrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  // En la moneda del cobro: lo aplicado a cada factura convertido por el bolivar.
  amount: number;
  amountVes: number | null;
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
  // Cada importe en la moneda de su factura.
  allocations: { id: string; invoiceId: string; amount: number }[];
}

// Las tasas del dia del cobro: la de su moneda, la de la moneda de cada factura que aplica (en
// bolivares por unidad) y los decimales de la empresa.
export interface PaymentRates {
  currency: DocumentCurrency;
  invoiceRates: Record<string, number>;
  decimals: number;
}

type Body = Omit<PaymentPrimitives, 'id' | 'tenantId' | 'code' | 'status' | 'confirmedAt' | 'cancelledAt' | 'createdAt' | 'updatedAt'>;

const RATE_SCALE = 100_000_000n;

// Un cobro de un cliente, repartido entre sus facturas. Se puede cobrar en otra moneda: cada factura
// rebaja su deuda en su moneda y el cobro recibe lo equivalente por el bolivar, con las tasas de su
// dia. En borrador no toca ningun saldo; confirmado, congela las tasas y baja el de cada factura;
// anulado, lo devuelve. Aqui no hay anticipos ni pagos de mas.
export class CustomerPayment {
  private constructor(
    private row: PaymentPrimitives,
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: PaymentId,
    tenantId: TenantId,
    code: string,
    details: PaymentDetails,
    invoices: ReceivableInvoice[],
    rates: PaymentRates,
    now: Date,
    today: string,
  ): CustomerPayment {
    return new CustomerPayment({
      id: id.value,
      tenantId: tenantId.value,
      code,
      ...valued(details, invoices, rates, today),
      status: 'draft',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPrimitives(row: PaymentPrimitives): CustomerPayment {
    return new CustomerPayment(structuredClone(row), row.updatedAt);
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

  paymentDate(): ReceivablesDate {
    return ReceivablesDate.of(this.row.paymentDate);
  }

  currency(): DocumentCurrency {
    return DocumentCurrency.fromPrimitives(this.row);
  }

  // El `updatedAt` con que se leyo: guardar o confirmar sobre otra version perderia lo que alguien guardo.
  version(): Date | null {
    return this.loadedVersion;
  }

  // Las tasas se calcularon con el borrador leido antes del bloqueo; si cambio, ya no le corresponden.
  ensureUnchangedSince(version: Date | null): void {
    if (this.row.status === 'draft' && this.row.updatedAt.getTime() !== version?.getTime()) throw new ConcurrentModificationError(this.row.id);
  }

  currentStatus(): PaymentStatus {
    return this.row.status;
  }

  invoiceIds(): string[] {
    return this.row.allocations.map((allocation) => allocation.invoiceId);
  }

  update(details: PaymentDetails, invoices: ReceivableInvoice[], rates: PaymentRates, now: Date, today: string): void {
    if (this.row.status !== 'draft') throw new PaymentNotEditableError(this.row.id, this.row.status);

    this.row = { ...this.row, ...valued(details, invoices, rates, today), updatedAt: now };
  }

  // Cada factura, con lo que ya le cobraron OTROS cobros, tiene que aceptar lo que este le aplica.
  ensureFits(invoices: ReceivableInvoice[]): void {
    const date = ReceivablesDate.of(this.row.paymentDate);

    for (const allocation of this.row.allocations) {
      const invoice = invoices.find((candidate) => candidate.id === allocation.invoiceId);

      if (!invoice) throw new ReceivableInvoiceNotFoundError(allocation.invoiceId);

      invoice.ensureAccepts(this.row.customerId, date, paymentUnits(allocation.amount, 4));
    }
  }

  // Con las facturas bloqueadas y las tasas del dia del cobro, que quedan congeladas. `rates` solo
  // falta cuando el cobro ya no es un borrador.
  confirm(invoices: ReceivableInvoice[], rates: PaymentRates | null, now: Date, today: string): void {
    if (this.row.status !== 'draft' || rates === null) throw new PaymentNotConfirmableError(this.row.id, this.row.status);

    const details = {
      customerId: this.row.customerId,
      date: ReceivablesDate.of(this.row.paymentDate),
      method: this.row.method,
      reference: this.row.reference,
      notes: this.row.notes,
      allocations: this.row.allocations.map(({ id, invoiceId, amount }) => ({ id, invoiceId, amount })),
    };
    const valuedRow = { ...this.row, ...valued(details, invoices, rates, today) };

    CustomerPayment.fromPrimitives(valuedRow).ensureFits(invoices);

    this.row = { ...valuedRow, status: 'confirmed', confirmedAt: now, updatedAt: now };
  }

  // Anular un confirmado devuelve el saldo a sus facturas; anular un borrador solo lo descarta.
  cancel(now: Date): void {
    if (this.row.status === 'cancelled') throw new PaymentAlreadyCancelledError(this.row.id);

    this.row = { ...this.row, status: 'cancelled', cancelledAt: now, updatedAt: now };
  }
}

function valued(details: PaymentDetails, invoices: ReceivableInvoice[], rates: PaymentRates, today: string): Body {
  if (!PAYMENT_METHODS.includes(details.method as PaymentMethod)) throw new InvalidPaymentMethodError(details.method);
  if (details.allocations.length === 0) throw new EmptyPaymentError();

  details.date.ensureNotAfter(today);

  const { decimals } = rates;
  const paymentRate = rateUnits(rates.currency.exchangeRate ?? 1);
  const seen = new Set<string>();
  let received = 0n;
  let bolivars = 0n;

  const allocations = details.allocations.map((allocation) => {
    if (seen.has(allocation.invoiceId)) throw new DuplicatePaymentInvoiceError(allocation.invoiceId);

    seen.add(allocation.invoiceId);

    const amount = paymentUnits(allocation.amount, decimals);
    const invoice = invoices.find((candidate) => candidate.id === allocation.invoiceId);

    if (!invoice) throw new ReceivableInvoiceNotFoundError(allocation.invoiceId);

    const invoiceCurrency = invoice.currency().currency;
    const rate = rates.invoiceRates[invoiceCurrency];

    if (rate === undefined) throw new MissingExchangeRateError(invoiceCurrency, 'legal', details.date.value);

    // Todo pasa por el bolivar: lo aplicado vale `amount x rate` bolivares.
    received += roundRatio(amount * rateUnits(rate), paymentRate, decimals);
    bolivars += roundRatio(amount * rateUnits(rate), RATE_SCALE, decimals);

    const difference = invoice.exchangeDifference(amount, rate, decimals);

    return {
      id: allocation.id,
      invoiceId: allocation.invoiceId,
      amount: unitsToNumber(amount),
      exchangeRate: rate,
      exchangeDifference: difference === null ? null : unitsToNumber(difference),
    };
  });

  return {
    customerId: details.customerId,
    paymentDate: details.date.value,
    method: details.method as PaymentMethod,
    reference: optionalText(details.reference, 100, 'PaymentReference'),
    notes: optionalText(details.notes, 500, 'PaymentNotes'),
    ...rates.currency.toPrimitives(),
    amount: unitsToNumber(received),
    amountVes: unitsToNumber(bolivars),
    allocations,
  };
}
