import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteLineAmountExceedsInvoiceError,
  CreditNoteLineInvoiceMismatchError,
  CreditNoteLineItemMismatchError,
  CreditNoteReturnLinesNotFromInvoiceError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteReturnSupplierMismatchError,
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PayableInvoiceNotFoundError,
  PayableSupplierNotFoundError,
  PaymentBeforeInvoiceError,
} from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import {
  CreditNoteReason,
  SupplierCreditNote,
  SupplierCreditNoteId,
  SupplierCreditNoteLineInput,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { PayablesCodeSequence, payablesCode } from '../../domain/shared/code-sequence.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CreateSupplierCreditNoteRequest {
  tenantId: string;
  supplierId: string;
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

export class SupplierCreditNoteCreator {
  constructor(
    private readonly creditNotes: SupplierCreditNoteRepository,
    private readonly ledger: PayablesLedger,
    private readonly codes: PayablesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: CreateSupplierCreditNoteRequest): Promise<{ id: string; code: string }> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const supplier = await this.ledger.supplier(tenantId, request.supplierId);
    if (!supplier) throw new PayableSupplierNotFoundError(request.supplierId);

    const date = request.issueDate ? PayablesDate.of(request.issueDate) : PayablesDate.of(today);
    date.ensureNotAfter(today);

    let currency: DocumentCurrency;

    // Si cita factura: adopta su moneda y tasa, y valida cupo de importe
    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      if (!invoice) throw new PayableInvoiceNotFoundError(request.invoiceId);
      if (invoice.toPrimitives().status === 'cancelled') throw new InvoiceNotPayableError(request.invoiceId);
      if (invoice.toPrimitives().supplierId !== request.supplierId) {
        throw new InvoiceOfAnotherSupplierError(request.invoiceId, request.supplierId);
      }

      if (date.value < invoice.toPrimitives().issueDate) {
        throw new PaymentBeforeInvoiceError(request.invoiceId, date.value);
      }

      currency = invoice.currency();
    } else {
      const companyCurrency = await this.rates.companyCurrency(request.tenantId);
      const rateSet = await this.rates.forDocument(request.tenantId, {
        currency: request.currency ?? companyCurrency,
        date: date.value,
        manualRate: request.exchangeRate,
        keepsCurrency: false,
      });
      currency = DocumentCurrency.of(rateSet);
    }

    const decimals = await this.rates.amountDecimals(request.tenantId);
    const noteId = SupplierCreditNoteId.of(this.ids.next());

    const invoiceLines = request.invoiceId ? await this.ledger.invoiceLines(tenantId, request.invoiceId) : [];
    const invoiceLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));

    const lines: SupplierCreditNoteLineInput[] = request.lines.map((l) => {
      const invLine = l.invoiceLineId ? invoiceLinesMap.get(l.invoiceLineId) : null;
      return {
        id: l.id ?? this.ids.next(),
        invoiceLineId: l.invoiceLineId,
        itemId: l.itemId ?? invLine?.itemId ?? null,
        itemSku: l.itemSku,
        itemName: l.itemName,
        concept: l.concept,
        unitId: l.unitId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate ?? 0,
      };
    });

    const details = {
      supplierId: request.supplierId,
      invoiceId: request.invoiceId,
      purchaseReturnId: request.purchaseReturnId,
      issueDate: date,
      reason: request.reason,
      reasonDetail: request.reasonDetail,
      notes: request.notes,
      currency,
      lines,
    };

    const candidate = SupplierCreditNote.draft(
      noteId,
      tenantId,
      payablesCode('NCP', 0),
      details,
      now,
      today,
      decimals,
    );

    // Valida cupo de importe y lineas de factura / devolucion
    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      const alreadyCredited = await this.creditNotes.creditedAmountByInvoice(tenantId, request.invoiceId);
      PayableCreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, candidate.total(), request.invoiceId);

      const candidateLinePrimitives = candidate.toPrimitives().lines;
      const invoiceLineIds = candidateLinePrimitives
        .map((l) => l.invoiceLineId)
        .filter((id): id is string => Boolean(id));
      const alreadyCreditedByLine = await this.creditNotes.creditedAmountByInvoiceLines(tenantId, invoiceLineIds);

      const consumedInSameNote = new Map<string, number>();
      for (const line of candidateLinePrimitives) {
        if (line.invoiceLineId) {
          const invLine = invoiceLinesMap.get(line.invoiceLineId);
          if (!invLine) {
            throw new CreditNoteLineInvoiceMismatchError(line.invoiceLineId, request.invoiceId);
          }
          if (invLine.itemId && line.itemId && line.itemId !== invLine.itemId) {
            throw new CreditNoteLineItemMismatchError(line.invoiceLineId, invLine.itemId, line.itemId);
          }
          const alreadyDiscounted = alreadyCreditedByLine.get(line.invoiceLineId) ?? 0;
          const consumedInNote = consumedInSameNote.get(line.invoiceLineId) ?? 0;
          const availableQuota = Number((invLine.subtotal - alreadyDiscounted - consumedInNote).toFixed(4));
          if (line.subtotal > availableQuota + 0.0001) {
            throw new CreditNoteLineAmountExceedsInvoiceError(
              line.invoiceLineId,
              line.subtotal,
              Math.max(0, availableQuota),
            );
          }
          consumedInSameNote.set(line.invoiceLineId, consumedInNote + line.subtotal);
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

    const code = payablesCode('NCP', await this.codes.next(tenantId, 'NCP'));
    const creditNote = SupplierCreditNote.draft(
      noteId,
      tenantId,
      code,
      details,
      now,
      today,
      decimals,
    );

    await this.creditNotes.save(creditNote);

    return { id: noteId.value, code };
  }
}
