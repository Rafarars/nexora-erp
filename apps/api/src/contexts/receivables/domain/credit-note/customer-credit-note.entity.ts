import { roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency, DocumentCurrencyPrimitives, rateUnits } from '../../../../shared/domain/document-currency.js';
import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteNotConfirmableError,
  CreditNoteNotEditableError,
  CreditNoteReasonDetailRequiredError,
  EmptyCreditNoteError,
  InvalidCreditNoteLineAmountError,
} from '../errors/receivables.errors.js';
import { paymentUnits } from '../shared/amount.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class CreditNoteId extends Uuid {
  static of(value: string): CreditNoteId {
    return new CreditNoteId(value);
  }
}

export const CREDIT_NOTE_REASONS = ['return', 'subsequent_discount', 'price_correction', 'damaged_goods', 'cancellation', 'other'] as const;
export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number];

export const CREDIT_NOTE_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

export interface CustomerCreditNoteLinePrimitives {
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

export interface CustomerCreditNotePrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  invoiceId: string | null;
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
  subtotalVes: number | null;
  taxVes: number | null;
  totalVes: number | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: CustomerCreditNoteLinePrimitives[];
}

export interface CreditNoteLineInput {
  id: string;
  itemId?: string | null;
  itemSku?: string | null;
  itemName?: string | null;
  concept?: string | null;
  unitId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CreditNoteDetails {
  customerId: string;
  invoiceId?: string | null;
  salesReturnId?: string | null;
  issueDate: ReceivablesDate;
  reason: CreditNoteReason;
  reasonDetail?: string | null;
  notes?: string | null;
  currency: DocumentCurrency;
  lines: CreditNoteLineInput[];
}

const RATE_SCALE = 100_000_000n;

export class CustomerCreditNote {
  private constructor(
    private row: CustomerCreditNotePrimitives,
    private readonly loadedVersion: Date | null = null,
  ) {}

  static draft(
    id: CreditNoteId,
    tenantId: TenantId,
    code: string,
    details: CreditNoteDetails,
    now: Date,
    today: string,
    decimals = 2,
  ): CustomerCreditNote {
    const valued = valueDetails(details, today, decimals);

    return new CustomerCreditNote({
      id: id.value,
      tenantId: tenantId.value,
      code,
      ...valued,
      issuePaymentId: null,
      status: 'draft',
      confirmedAt: null,
      cancelledAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPrimitives(row: CustomerCreditNotePrimitives): CustomerCreditNote {
    return new CustomerCreditNote(structuredClone(row), row.updatedAt);
  }

  toPrimitives(): CustomerCreditNotePrimitives {
    return structuredClone(this.row);
  }

  get id(): CreditNoteId {
    return CreditNoteId.of(this.row.id);
  }

  get code(): string {
    return this.row.code;
  }

  customerId(): string {
    return this.row.customerId;
  }

  invoiceId(): string | null {
    return this.row.invoiceId;
  }

  salesReturnId(): string | null {
    return this.row.salesReturnId;
  }

  issuePaymentId(): string | null {
    return this.row.issuePaymentId;
  }

  issueDate(): ReceivablesDate {
    return ReceivablesDate.of(this.row.issueDate);
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

  lines(): CustomerCreditNoteLinePrimitives[] {
    return structuredClone(this.row.lines);
  }

  version(): Date | null {
    return this.loadedVersion;
  }

  update(details: CreditNoteDetails, now: Date, today: string, decimals = 2): void {
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

  setIssuePaymentId(paymentId: string): void {
    this.assignIssuePayment(paymentId);
  }

  confirm(now: Date, issuePaymentId: string | null = null): void {
    if (this.row.status !== 'draft') {
      throw new CreditNoteNotConfirmableError(this.row.id, this.row.status);
    }

    this.row = {
      ...this.row,
      status: 'confirmed',
      issuePaymentId: issuePaymentId ?? this.row.issuePaymentId,
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
  details: CreditNoteDetails,
  today: string,
  decimals: number,
): Omit<
  CustomerCreditNotePrimitives,
  'id' | 'tenantId' | 'code' | 'issuePaymentId' | 'status' | 'confirmedAt' | 'cancelledAt' | 'createdAt' | 'updatedAt'
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

  const lines: CustomerCreditNoteLinePrimitives[] = details.lines.map((line, index) => {
    if (line.quantity <= 0 || line.unitPrice <= 0) {
      throw new InvalidCreditNoteLineAmountError();
    }

    const qty = paymentUnits(line.quantity, 4);
    const price = paymentUnits(line.unitPrice, 4);
    const lineSubtotal = roundRatio(qty * price, 10_000n, decimals);

    const taxRateScale = 10_000n;
    const taxRateUnits = BigInt(Math.round(line.taxRate * 10_000));
    const lineTax = roundRatio(lineSubtotal * taxRateUnits, taxRateScale, decimals);
    const lineTotal = lineSubtotal + lineTax;

    subtotalUnits += lineSubtotal;
    taxUnits += lineTax;

    return {
      id: line.id,
      lineNumber: index + 1,
      itemId: line.itemId ?? null,
      itemSku: line.itemSku ?? null,
      itemName: line.itemName ?? null,
      concept: line.concept ?? null,
      unitId: line.unitId ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
      subtotal: unitsToNumber(lineSubtotal),
      tax: unitsToNumber(lineTax),
      total: unitsToNumber(lineTotal),
    };
  });

  const totalUnits = subtotalUnits + taxUnits;
  const currencyPrimitives = details.currency.toPrimitives();

  let subtotalVes: number | null = null;
  let taxVes: number | null = null;
  let totalVes: number | null = null;

  if (currencyPrimitives.exchangeRate !== null) {
    const rate = rateUnits(currencyPrimitives.exchangeRate);
    subtotalVes = unitsToNumber(roundRatio(subtotalUnits * rate, RATE_SCALE, decimals));
    taxVes = unitsToNumber(roundRatio(taxUnits * rate, RATE_SCALE, decimals));
    totalVes = unitsToNumber(roundRatio(totalUnits * rate, RATE_SCALE, decimals));
  }

  return {
    customerId: details.customerId,
    invoiceId: details.invoiceId ?? null,
    salesReturnId: details.salesReturnId ?? null,
    issueDate: details.issueDate.value,
    reason: details.reason,
    reasonDetail: optionalText(details.reasonDetail, 500, 'ReasonDetail'),
    notes: optionalText(details.notes, 500, 'Notes'),
    ...currencyPrimitives,
    subtotal: unitsToNumber(subtotalUnits),
    tax: unitsToNumber(taxUnits),
    total: unitsToNumber(totalUnits),
    subtotalVes,
    taxVes,
    totalVes,
    lines,
  };
}
