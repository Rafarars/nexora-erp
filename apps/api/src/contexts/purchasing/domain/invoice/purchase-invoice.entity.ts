import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import {
  DuplicatePurchaseInvoiceLineError,
  EmptyPurchaseInvoiceError,
  InvoiceDueDateBeforeIssueDateError,
  PurchaseInvoiceAlreadyCancelledError,
  PurchaseInvoiceNotConfirmableError,
  PurchaseInvoiceNotEditableError,
} from '../errors/purchasing.errors.js';
import { PurchaseDate } from '../shared/purchase-date.vo.js';
import { optionalText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier/supplier.entity.js';
import { PurchaseInvoiceId } from './purchase-invoice-id.vo.js';
import { PurchaseInvoiceLine, PurchaseInvoiceLinePrimitives } from './purchase-invoice-line.js';
import { SupplierInvoiceNumber } from './supplier-invoice-number.vo.js';

export { PurchaseInvoiceId };
export { SupplierInvoiceNumber };

export type PurchaseInvoiceStatus = 'draft' | 'confirmed' | 'cancelled';

export interface PurchaseInvoiceDetails {
  supplierId: SupplierId;
  supplierInvoiceNumber: SupplierInvoiceNumber;
  supplierInvoiceSeries: string | null;
  issueDate: PurchaseDate;
  dueDate: PurchaseDate;
  notes: string | null;
  lines: PurchaseInvoiceLine[];
  currency: DocumentCurrency;
}

export interface PurchaseInvoicePrimitives extends DocumentCurrencyPrimitives {
  id: string;
  tenantId: string;
  code: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceSeries: string | null;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  status: PurchaseInvoiceStatus;
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
  lines: PurchaseInvoiceLinePrimitives[];
}

const NOTES_MAX = 500;
const SERIES_MAX = 20;

export class PurchaseInvoice {
  private constructor(
    readonly id: PurchaseInvoiceId,
    readonly tenantId: TenantId,
    readonly code: string,
    private details: PurchaseInvoiceDetails,
    private status: PurchaseInvoiceStatus,
    private _priceDifference: number,
    private _exchangeDifference: number,
    private confirmedAt: Date | null,
    private cancelledAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static draft(
    id: PurchaseInvoiceId,
    tenantId: TenantId,
    code: string,
    details: PurchaseInvoiceDetails,
    now: Date,
    today: string,
  ): PurchaseInvoice {
    return new PurchaseInvoice(
      id,
      tenantId,
      code,
      validated(details, today),
      'draft',
      0,
      0,
      null,
      null,
      now,
      now,
    );
  }

  static fromPrimitives(row: PurchaseInvoicePrimitives): PurchaseInvoice {
    return new PurchaseInvoice(
      PurchaseInvoiceId.of(row.id),
      TenantId.of(row.tenantId),
      row.code,
      {
        supplierId: SupplierId.of(row.supplierId),
        supplierInvoiceNumber: SupplierInvoiceNumber.of(row.supplierInvoiceNumber),
        supplierInvoiceSeries: row.supplierInvoiceSeries,
        issueDate: PurchaseDate.of(row.issueDate),
        dueDate: PurchaseDate.of(row.dueDate),
        notes: row.notes,
        currency: DocumentCurrency.fromPrimitives(row),
        lines: [...row.lines]
          .sort((a, b) => a.lineNumber - b.lineNumber)
          .map((line) => PurchaseInvoiceLine.fromPrimitives(line)),
      },
      row.status,
      row.priceDifference,
      row.exchangeDifference,
      row.confirmedAt,
      row.cancelledAt,
      row.createdAt,
      row.updatedAt,
    );
  }

  get supplierId(): SupplierId {
    return this.details.supplierId;
  }

  get supplierInvoiceNumber(): SupplierInvoiceNumber {
    return this.details.supplierInvoiceNumber;
  }

  get supplierInvoiceSeries(): string | null {
    return this.details.supplierInvoiceSeries;
  }

  get issueDate(): PurchaseDate {
    return this.details.issueDate;
  }

  get dueDate(): PurchaseDate {
    return this.details.dueDate;
  }

  get notes(): string | null {
    return this.details.notes;
  }

  get currentStatus(): PurchaseInvoiceStatus {
    return this.status;
  }

  get currency(): DocumentCurrency {
    return this.details.currency;
  }

  lines(): readonly PurchaseInvoiceLine[] {
    return this.details.lines;
  }

  totals(decimals: number): { subtotal: number; tax: number; total: number } {
    const subtotal = this.details.lines.reduce((sum, line) => sum + line.subtotalUnits(decimals), 0n);
    const tax = this.details.lines.reduce((sum, line) => sum + line.taxUnits(decimals), 0n);

    return {
      subtotal: unitsToNumber(subtotal),
      tax: unitsToNumber(tax),
      total: unitsToNumber(subtotal + tax),
    };
  }

  update(details: PurchaseInvoiceDetails, now: Date, today: string): void {
    if (this.status !== 'draft') {
      throw new PurchaseInvoiceNotEditableError(this.id.value, this.status);
    }
    this.details = validated(details, today);
    this.updatedAt = now;
  }

  get priceDifference(): number {
    return this._priceDifference;
  }

  get exchangeDifference(): number {
    return this._exchangeDifference;
  }

  confirm(now: Date, priceDifference: number = 0, exchangeDifference: number = 0): void {
    if (this.status !== 'draft') {
      throw new PurchaseInvoiceNotConfirmableError(this.id.value, this.status);
    }
    this.status = 'confirmed';
    this._priceDifference = priceDifference;
    this._exchangeDifference = exchangeDifference;
    this.confirmedAt = now;
    this.updatedAt = now;
  }

  cancel(now: Date): void {
    if (this.status === 'cancelled') {
      throw new PurchaseInvoiceAlreadyCancelledError(this.id.value);
    }
    this.status = 'cancelled';
    this.cancelledAt = now;
    this.updatedAt = now;
  }

  setDifferences(priceDiff: number, exchangeDiff: number): void {
    this._priceDifference = priceDiff;
    this._exchangeDifference = exchangeDiff;
  }

  toPrimitives(decimals: number = 2): PurchaseInvoicePrimitives {
    const subtotalUnits = this.details.lines.reduce((sum, line) => sum + line.subtotalUnits(decimals), 0n);
    const taxUnits = this.details.lines.reduce((sum, line) => sum + line.taxUnits(decimals), 0n);
    const totalUnits = subtotalUnits + taxUnits;

    const subtotal = unitsToNumber(subtotalUnits);
    const tax = unitsToNumber(taxUnits);
    const total = unitsToNumber(totalUnits);

    const subtotalVesUnits = this.details.currency.bolivars(subtotalUnits, decimals);
    const taxVesUnits = this.details.currency.bolivars(taxUnits, decimals);
    const totalVesUnits = this.details.currency.bolivars(totalUnits, decimals);

    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      supplierId: this.details.supplierId.value,
      supplierInvoiceNumber: this.details.supplierInvoiceNumber.value,
      supplierInvoiceSeries: this.details.supplierInvoiceSeries,
      issueDate: this.details.issueDate.value,
      dueDate: this.details.dueDate.value,
      notes: this.details.notes,
      status: this.status,
      subtotal,
      tax,
      total,
      subtotalVes: subtotalVesUnits !== null ? unitsToNumber(subtotalVesUnits) : null,
      taxVes: taxVesUnits !== null ? unitsToNumber(taxVesUnits) : null,
      totalVes: totalVesUnits !== null ? unitsToNumber(totalVesUnits) : null,
      priceDifference: this._priceDifference,
      exchangeDifference: this._exchangeDifference,
      confirmedAt: this.confirmedAt,
      cancelledAt: this.cancelledAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lines: this.details.lines.map((line) => line.toPrimitives(decimals)),
      ...this.details.currency.toPrimitives(),
    };
  }
}

function validated(details: PurchaseInvoiceDetails, today: string): PurchaseInvoiceDetails {
  if (details.lines.length === 0) {
    throw new EmptyPurchaseInvoiceError();
  }

  // La fecha de emision no puede ser futura
  details.issueDate.ensureNotAfter(today);

  // La fecha de vencimiento no puede ser anterior a la de emision (H9 §4.1 regla 2)
  if (details.dueDate.value < details.issueDate.value) {
    throw new InvoiceDueDateBeforeIssueDateError(details.issueDate.value, details.dueDate.value);
  }

  const seenLineIds = new Set<string>();
  for (const line of details.lines) {
    if (seenLineIds.has(line.id.value)) {
      throw new DuplicatePurchaseInvoiceLineError(line.id.value);
    }
    seenLineIds.add(line.id.value);
  }

  const series = optionalText(details.supplierInvoiceSeries, SERIES_MAX, 'SupplierInvoiceSeries');

  return {
    ...details,
    supplierInvoiceSeries: series,
    notes: optionalText(details.notes, NOTES_MAX, 'Notes'),
  };
}
