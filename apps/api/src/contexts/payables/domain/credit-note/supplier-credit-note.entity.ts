import { roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency, DocumentCurrencyPrimitives, rateUnits } from '../../../../shared/domain/document-currency.js';
import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteLineInvoiceLineRequiredError,
  CreditNoteNotConfirmableError,
  CreditNoteNotEditableError,
  CreditNoteReasonDetailRequiredError,
  EmptyCreditNoteError,
  InvalidCreditNoteLineAmountError,
} from '../errors/payables.errors.js';
import { paymentUnits } from '../shared/amount.js';
import { PayablesDate } from '../shared/payables-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class SupplierCreditNoteId extends Uuid {
  static of(value: string): SupplierCreditNoteId {
    return new SupplierCreditNoteId(value);
  }
}

export const CREDIT_NOTE_REASONS = [
  'return',
  'subsequent_discount',
  'price_correction',
  'damaged_goods',
  'cancellation',
  'other',
] as const;

export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number];

export const CREDIT_NOTE_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

export interface SupplierCreditNoteLinePrimitives {
  id: string;
  lineNumber: number;
  invoiceLineId: string | null;
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

export interface SupplierCreditNotePrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  invoiceId: string | null;
  purchaseReturnId: string | null;
  issuePaymentId: string | null;
  issueDate: string;
  reason: CreditNoteReason;
  reasonDetail: string | null;
  notes: string | null;
  status: CreditNoteStatus;
  subtotal: number;
  tax: number;
  total: number;
  subtotalVes: number | null;
  taxVes: number | null;
  totalVes: number | null;
  priceDifference: number;
  exchangeDifference: number;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: SupplierCreditNoteLinePrimitives[];
}

export interface SupplierCreditNoteLineInput {
  id: string;
  invoiceLineId?: string | null;
  itemId?: string | null;
  itemSku?: string | null;
  itemName?: string | null;
  concept?: string | null;
  unitId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface SupplierCreditNoteDetails {
  supplierId: string;
  invoiceId?: string | null;
  purchaseReturnId?: string | null;
  issueDate: PayablesDate;
  reason: CreditNoteReason;
  reasonDetail?: string | null;
  notes?: string | null;
  currency: DocumentCurrency;
  lines: SupplierCreditNoteLineInput[];
}

const RATE_SCALE = 100_000_000n;

export class SupplierCreditNote {
  private constructor(
    private row: SupplierCreditNotePrimitives,
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: SupplierCreditNoteId,
    tenantId: TenantId,
    code: string,
    details: SupplierCreditNoteDetails,
    now: Date,
    today: string,
    decimals = 2,
  ): SupplierCreditNote {
    const valued = valueDetails(details, today, decimals);

    return new SupplierCreditNote({
      id: id.value,
      tenantId: tenantId.value,
      code,
      ...valued,
      issuePaymentId: null,
      priceDifference: 0,
      exchangeDifference: 0,
      status: 'draft',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPrimitives(row: SupplierCreditNotePrimitives): SupplierCreditNote {
    return new SupplierCreditNote(structuredClone(row), row.updatedAt);
  }

  toPrimitives(): SupplierCreditNotePrimitives {
    return structuredClone(this.row);
  }

  get id(): SupplierCreditNoteId {
    return SupplierCreditNoteId.of(this.row.id);
  }

  get code(): string {
    return this.row.code;
  }

  supplierId(): string {
    return this.row.supplierId;
  }

  invoiceId(): string | null {
    return this.row.invoiceId;
  }

  purchaseReturnId(): string | null {
    return this.row.purchaseReturnId;
  }

  issuePaymentId(): string | null {
    return this.row.issuePaymentId;
  }

  issueDate(): PayablesDate {
    return PayablesDate.of(this.row.issueDate);
  }

  reason(): CreditNoteReason {
    return this.row.reason;
  }

  reasonDetail(): string | null {
    return this.row.reasonDetail;
  }

  currency(): DocumentCurrency {
    return DocumentCurrency.fromPrimitives(this.row);
  }

  currentStatus(): CreditNoteStatus {
    return this.row.status;
  }

  total(): number {
    return this.row.total;
  }

  subtotal(): number {
    return this.row.subtotal;
  }

  tax(): number {
    return this.row.tax;
  }

  lines(): SupplierCreditNoteLinePrimitives[] {
    return structuredClone(this.row.lines);
  }

  version(): Date | null {
    return this.loadedVersion;
  }

  update(details: SupplierCreditNoteDetails, now: Date, today: string, decimals = 2): void {
    if (this.row.status !== 'draft') {
      throw new CreditNoteNotEditableError(this.row.id, this.row.status);
    }

    const valued = valueDetails(details, today, decimals);
    this.row = {
      ...this.row,
      ...valued,
      updatedAt: now,
    };
  }

  assignIssuePayment(paymentId: string): void {
    this.row.issuePaymentId = paymentId;
  }

  confirm(now: Date, issuePaymentId: string | null = null, priceDifference = 0, exchangeDifference = 0): void {
    if (this.row.status !== 'draft') {
      throw new CreditNoteNotConfirmableError(this.row.id, this.row.status);
    }

    this.row = {
      ...this.row,
      status: 'confirmed',
      issuePaymentId: issuePaymentId ?? this.row.issuePaymentId,
      priceDifference,
      exchangeDifference,
      confirmedAt: now,
      updatedAt: now,
    };
  }

  cancel(now: Date): void {
    if (this.row.status === 'cancelled') {
      throw new CreditNoteAlreadyCancelledError(this.row.id);
    }

    this.row = {
      ...this.row,
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    };
  }
}

function valueDetails(
  details: SupplierCreditNoteDetails,
  today: string,
  decimals: number,
): Omit<
  SupplierCreditNotePrimitives,
  | 'id'
  | 'tenantId'
  | 'code'
  | 'issuePaymentId'
  | 'priceDifference'
  | 'exchangeDifference'
  | 'status'
  | 'confirmedAt'
  | 'cancelledAt'
  | 'createdAt'
  | 'updatedAt'
> {
  details.issueDate.ensureNotAfter(today);

  if (details.reason === 'other' && (!details.reasonDetail || details.reasonDetail.trim() === '')) {
    throw new CreditNoteReasonDetailRequiredError();
  }

  if (details.lines.length === 0) {
    throw new EmptyCreditNoteError();
  }

  let subtotalUnits = 0n;
  let taxUnits = 0n;

  const lines: SupplierCreditNoteLinePrimitives[] = details.lines.map((input, index) => {
    if (input.quantity <= 0 || input.unitPrice <= 0) {
      throw new InvalidCreditNoteLineAmountError();
    }

    if (details.invoiceId && !details.purchaseReturnId && input.itemId && !input.invoiceLineId) {
      throw new CreditNoteLineInvoiceLineRequiredError(index + 1);
    }

    const qty = paymentUnits(input.quantity, 4);
    const price = paymentUnits(input.unitPrice, 4);
    const lineSubtotal = roundRatio(qty * price, 10_000n, decimals);

    const taxRateScale = input.taxRate > 1 ? 1_000_000n : 10_000n;
    const taxRateUnits = BigInt(Math.round(input.taxRate * 10_000));
    const lineTax = roundRatio(lineSubtotal * taxRateUnits, taxRateScale, decimals);
    const lineTotal = lineSubtotal + lineTax;

    subtotalUnits += lineSubtotal;
    taxUnits += lineTax;

    return {
      id: input.id,
      lineNumber: index + 1,
      invoiceLineId: details.purchaseReturnId ? null : (input.invoiceLineId ?? null),
      itemId: input.itemId ?? null,
      itemSku: input.itemSku ?? null,
      itemName: input.itemName ?? input.concept ?? null,
      concept: input.concept ?? null,
      unitId: input.unitId ?? null,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      taxRate: input.taxRate,
      subtotal: unitsToNumber(lineSubtotal),
      tax: unitsToNumber(lineTax),
      total: unitsToNumber(lineTotal),
    };
  });

  const subtotal = unitsToNumber(subtotalUnits);
  const tax = unitsToNumber(taxUnits);
  const total = unitsToNumber(subtotalUnits + taxUnits);

  const curPrimitives = details.currency.toPrimitives();
  const rate = curPrimitives.exchangeRate ? rateUnits(curPrimitives.exchangeRate) : RATE_SCALE;

  const subtotalVes = unitsToNumber(roundRatio(subtotalUnits * rate, RATE_SCALE, decimals));
  const taxVes = unitsToNumber(roundRatio(taxUnits * rate, RATE_SCALE, decimals));
  const totalVes = unitsToNumber(roundRatio((subtotalUnits + taxUnits) * rate, RATE_SCALE, decimals));

  return {
    supplierId: details.supplierId,
    invoiceId: details.invoiceId ?? null,
    purchaseReturnId: details.purchaseReturnId ?? null,
    issueDate: details.issueDate.value,
    reason: details.reason,
    reasonDetail: optionalText(details.reasonDetail, 500, 'ReasonDetail'),
    notes: optionalText(details.notes, 500, 'Notes'),
    currency: curPrimitives.currency,
    exchangeRate: curPrimitives.exchangeRate,
    baseCurrency: curPrimitives.baseCurrency,
    baseExchangeRate: curPrimitives.baseExchangeRate,
    manualExchangeRate: curPrimitives.manualExchangeRate,
    subtotal,
    tax,
    total,
    subtotalVes,
    taxVes,
    totalVes,
    lines,
  };
}
