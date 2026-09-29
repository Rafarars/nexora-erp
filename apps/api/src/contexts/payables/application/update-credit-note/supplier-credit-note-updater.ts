import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteLineAmountExceedsInvoiceError,
  CreditNoteLineInvoiceMismatchError,
  CreditNoteNotFoundError,
  CreditNoteReturnLinesNotFromInvoiceError,
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PayableInvoiceNotFoundError,
  PayableSupplierNotFoundError,
  PaymentBeforeInvoiceError,
} from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import {
  CreditNoteReason,
  SupplierCreditNoteId,
  SupplierCreditNoteLineInput,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface UpdateSupplierCreditNoteRequest {
  tenantId: string;
  creditNoteId: string;
  supplierId?: string;
  invoiceId?: string | null;
  purchaseReturnId?: string | null;
  issueDate?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  reason: CreditNoteReason;
  reasonDetail?: string | null;
  notes?: string | null;
  lines: Array<{
    id?: string;
    invoiceLineId?: string | null;
    itemId?: string | null;
    itemSku?: string | null;
    itemName?: string | null;
    concept?: string | null;
    unitId?: string | null;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
}

export class SupplierCreditNoteUpdater {
  constructor(
    private readonly creditNotes: SupplierCreditNoteRepository,
    private readonly ledger: PayablesLedger,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: UpdateSupplierCreditNoteRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const noteId = SupplierCreditNoteId.of(request.creditNoteId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const note = await this.creditNotes.find(tenantId, noteId);
    if (!note) throw new CreditNoteNotFoundError(request.creditNoteId);

    const supplierId = request.supplierId ?? note.supplierId();
    const supplier = await this.ledger.supplier(tenantId, supplierId);
    if (!supplier) throw new PayableSupplierNotFoundError(supplierId);

    const date = request.issueDate ? PayablesDate.of(request.issueDate) : note.issueDate();
    date.ensureNotAfter(today);

    let currency: DocumentCurrency;

    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      if (!invoice) throw new PayableInvoiceNotFoundError(request.invoiceId);
      if (invoice.toPrimitives().status === 'cancelled') throw new InvoiceNotPayableError(request.invoiceId);
      if (invoice.toPrimitives().supplierId !== supplierId) {
        throw new InvoiceOfAnotherSupplierError(request.invoiceId, supplierId);
      }
      if (date.value < invoice.toPrimitives().issueDate) {
        throw new PaymentBeforeInvoiceError(request.invoiceId, date.value);
      }
      currency = invoice.currency();
    } else {
      const companyCurrency = await this.rates.companyCurrency(request.tenantId);
      const manualRate =
        request.exchangeRate !== undefined
          ? request.exchangeRate
          : note.currency().manualRate()
            ? note.currency().exchangeRate
            : null;
      const rateSet = await this.rates.forDocument(request.tenantId, {
        currency: request.currency ?? note.currency().currency ?? companyCurrency,
        date: date.value,
        manualRate: manualRate ?? null,
        keepsCurrency: false,
      });
      currency = DocumentCurrency.of(rateSet);
    }

    const decimals = await this.rates.amountDecimals(request.tenantId);

    const lines: SupplierCreditNoteLineInput[] = request.lines.map((l) => ({
      id: l.id ?? this.ids.next(),
      invoiceLineId: l.invoiceLineId,
      itemId: l.itemId,
      itemSku: l.itemSku,
      itemName: l.itemName,
      concept: l.concept,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate ?? 0,
    }));

    const details = {
      supplierId,
      invoiceId: request.invoiceId,
      purchaseReturnId: request.purchaseReturnId,
      issueDate: date,
      reason: request.reason,
      reasonDetail: request.reasonDetail,
      notes: request.notes,
      currency,
      lines,
    };

    note.update(details, now, today, decimals);

    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      const alreadyCredited = await this.creditNotes.creditedAmountByInvoice(tenantId, request.invoiceId);
      PayableCreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, note.total(), request.invoiceId);

      const invoiceLines = await this.ledger.invoiceLines(tenantId, request.invoiceId);
      const invoiceLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));

      for (const line of note.toPrimitives().lines) {
        if (line.invoiceLineId) {
          const invLine = invoiceLinesMap.get(line.invoiceLineId);
          if (!invLine) {
            throw new CreditNoteLineInvoiceMismatchError(line.invoiceLineId, request.invoiceId);
          }
          if (line.subtotal > invLine.subtotal) {
            throw new CreditNoteLineAmountExceedsInvoiceError(line.invoiceLineId, line.subtotal, invLine.subtotal);
          }
        }
      }

      if (request.purchaseReturnId) {
        const returnReceiptLineIds = await this.ledger.returnReceiptLineIds(tenantId, request.purchaseReturnId);
        const invoiceReceiptLineIds = new Set(invoiceLines.map((il) => il.receiptLineId).filter(Boolean));
        const hasInvalidLine = returnReceiptLineIds.some((rId) => !invoiceReceiptLineIds.has(rId));
        if (hasInvalidLine) {
          throw new CreditNoteReturnLinesNotFromInvoiceError(request.purchaseReturnId, request.invoiceId);
        }
      }
    }

    await this.creditNotes.save(note);
  }
}
