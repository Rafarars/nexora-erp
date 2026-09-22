import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteNotFoundError,
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
} from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { CreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { ReceivablesDate } from '../../domain/shared/receivables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface UpdateCreditNoteRequest {
  tenantId: string;
  creditNoteId: string;
  customerId?: string;
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

export class CreditNoteUpdater {
  constructor(
    private readonly creditNotes: CustomerCreditNoteRepository,
    private readonly ledger: ReceivablesLedger,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: UpdateCreditNoteRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const note = await this.creditNotes.find(tenantId, CreditNoteId.of(request.creditNoteId));
    if (!note) throw new CreditNoteNotFoundError(request.creditNoteId);

    const customerId = request.customerId ?? note.customerId();
    const customer = await this.ledger.customer(tenantId, customerId);
    if (!customer) throw new ReceivableCustomerNotFoundError(customerId);

    const date = request.issueDate ? ReceivablesDate.of(request.issueDate) : note.issueDate();
    date.ensureNotAfter(today);

    const invoiceId = request.invoiceId !== undefined ? request.invoiceId : note.invoiceId();
    let currency: DocumentCurrency = note.currency();

    if (invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [invoiceId] });
      if (!invoice) throw new ReceivableInvoiceNotFoundError(invoiceId);
      if (invoice.toPrimitives().status === 'cancelled') throw new InvoiceNotPayableError(invoiceId);
      if (invoice.toPrimitives().customerId !== customerId) {
        throw new InvoiceOfAnotherCustomerError(invoiceId, customerId);
      }

      if (date.value < invoice.toPrimitives().issueDate) {
        throw new PaymentBeforeInvoiceError(invoiceId, date.value);
      }

      currency = invoice.currency();
    } else if (request.currency !== undefined || request.exchangeRate !== undefined || request.issueDate !== undefined) {
      const companyCurrency = await this.rates.companyCurrency(request.tenantId);
      const rateSet = await this.rates.forDocument(request.tenantId, {
        currency: request.currency ?? note.currency().currency ?? companyCurrency,
        date: date.value,
        manualRate: request.exchangeRate,
        keepsCurrency: true,
      });
      currency = DocumentCurrency.of(rateSet);
    }

    const decimals = await this.rates.amountDecimals(request.tenantId);

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

    note.update(
      {
        customerId,
        invoiceId,
        salesReturnId: request.salesReturnId !== undefined ? request.salesReturnId : note.salesReturnId(),
        issueDate: date,
        reason: request.reason,
        reasonDetail: request.reasonDetail,
        notes: request.notes,
        currency,
        lines,
      },
      now,
      today,
      decimals,
    );

    // Valida cupo de importe
    if (invoiceId) {
      const [invoice] = await this.ledger.invoices(tenantId, { ids: [invoiceId] });
      const alreadyCredited = await this.creditNotes.creditedAmountByInvoice(tenantId, invoiceId);
      CreditQuota.ensureWithinQuota(invoice.total(), alreadyCredited, note.total(), invoiceId);
    }

    await this.creditNotes.save(note);
  }
}
