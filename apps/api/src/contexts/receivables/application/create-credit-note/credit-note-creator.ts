import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteReturnCustomerMismatchError,
  CreditNoteReturnNotConfirmedError,
  InvoiceNotPayableError,
  InvoiceOfAnotherCustomerError,
  PaymentBeforeInvoiceError,
  ReceivableCustomerNotFoundError,
  ReceivableInvoiceNotFoundError,
} from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import {
  CreditNoteId,
  CreditNoteLineInput,
  CreditNoteReason,
  CustomerCreditNote,
} from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { CreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { ReceivablesCodeSequence, receivablesCode } from '../../domain/shared/code-sequence.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CreateCreditNoteRequest {
  tenantId: string;
  customerId: string;
  invoiceId?: string | null;
  salesReturnId?: string | null;
  issueDate?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  reason: CreditNoteReason;
  reasonDetail?: string | null;
  notes?: string | null;
  lines: Array<{
    id?: string;
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

export class CreditNoteCreator {
  constructor(
    private readonly creditNotes: CustomerCreditNoteRepository,
    private readonly ledger: ReceivablesLedger,
    private readonly codes: ReceivablesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: CreateCreditNoteRequest): Promise<{ id: string; code: string }> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const customer = await this.ledger.customer(tenantId, request.customerId);
    if (!customer) throw new ReceivableCustomerNotFoundError(request.customerId);

    const date = request.issueDate ? ReceivablesDate.of(request.issueDate) : ReceivablesDate.of(today);
    date.ensureNotAfter(today);

    let currency: DocumentCurrency;

    // Si cita factura: adopta su moneda y tasa, y valida cupo de importe
    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      if (!invoice) throw new ReceivableInvoiceNotFoundError(request.invoiceId);
      if (invoice.toPrimitives().status === 'cancelled') throw new InvoiceNotPayableError(request.invoiceId);
      if (invoice.toPrimitives().customerId !== request.customerId) {
        throw new InvoiceOfAnotherCustomerError(request.invoiceId, request.customerId);
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
    const noteId = CreditNoteId.of(this.ids.next());

    const lines: CreditNoteLineInput[] = request.lines.map((l) => ({
      id: l.id ?? this.ids.next(),
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
      customerId: request.customerId,
      invoiceId: request.invoiceId,
      salesReturnId: request.salesReturnId,
      issueDate: date,
      reason: request.reason,
      reasonDetail: request.reasonDetail,
      notes: request.notes,
      currency,
      lines,
    };

    const candidate = CustomerCreditNote.draft(
      noteId,
      tenantId,
      receivablesCode('NCC', 0),
      details,
      now,
      today,
      decimals,
    );

    // Valida cupo de importe
    if (request.invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [request.invoiceId] });
      const alreadyCredited = await this.creditNotes.creditedAmountByInvoice(tenantId, request.invoiceId);
      CreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, candidate.total(), request.invoiceId);
    }

    const code = receivablesCode('NCC', await this.codes.next(tenantId, 'NCC'));
    const creditNote = CustomerCreditNote.draft(
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
