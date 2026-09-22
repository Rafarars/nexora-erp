import { CustomerRef } from '../../domain/shared/references.vo.js';
import { CreditNoteNotFoundError, ReceivableCustomerNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import {
  CreditNoteId,
  CreditNoteReason,
  CreditNoteStatus,
  CustomerCreditNoteLinePrimitives,
} from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CreditNoteResponse {
  id: string;
  code: string;
  customer: { id: string; name: string };
  invoice: { id: string; code: string } | null;
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
  currency: {
    code: string;
    symbol: string;
    exchangeRate: number | null;
  };
  appliedAmount: number;
  availableCredit: number;
  lines: CustomerCreditNoteLinePrimitives[];
}

export interface CreditNoteSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  notes: CreditNoteResponse[];
  creditNotes: CreditNoteResponse[];
}

const DEFAULT_PAGE = 20;

export class CreditNoteSearcher {
  constructor(
    private readonly creditNotes: CustomerCreditNoteRepository,
    private readonly ledger: ReceivablesLedger,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    invoiceId?: string | null;
    status?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<CreditNoteSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.customerId) {
      const customer = await this.ledger.customer(tenantId, CustomerRef.of(request.customerId).value);
      if (!customer) throw new ReceivableCustomerNotFoundError(request.customerId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;

    const page = await this.creditNotes.searchPage(tenantId, {
      customerId: request.customerId ?? undefined,
      invoiceId: request.invoiceId ?? undefined,
      status: request.status ?? undefined,
      from: request.from ?? undefined,
      to: request.to ?? undefined,
      text: request.q?.trim() ? request.q.trim() : undefined,
      limit,
      offset,
    });

    const rows = page.notes.map((n) => n.toPrimitives());
    const customerIds = [...new Set(rows.map((n) => n.customerId))];
    const invoiceIds = [...new Set(rows.map((n) => n.invoiceId).filter((id): id is string => id !== null))];

    const [customers, invoices] = await Promise.all([
      Promise.all(customerIds.map((id) => this.ledger.customer(tenantId, id))),
      this.ledger.invoices(tenantId, { ids: invoiceIds }),
    ]);

    const customerMap = new Map(customers.filter(Boolean).map((c) => [c!.id, c!]));
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    const notesWithCredit: CreditNoteResponse[] = [];

    for (const note of page.notes) {
      const p = note.toPrimitives();
      const customer = customerMap.get(p.customerId);
      const invoice = p.invoiceId ? invoiceMap.get(p.invoiceId) : null;
      const applied = p.status === 'confirmed' ? await this.creditNotes.appliedPaymentsSum(tenantId, note.id) : 0;
      const available = p.status === 'confirmed' ? NoteCredit.available(p.total, applied) : 0;

      notesWithCredit.push({
        id: p.id,
        code: p.code,
        customer: { id: p.customerId, name: customer?.name ?? p.customerId },
        invoice: invoice ? { id: invoice.id, code: invoice.code } : null,
        salesReturnId: p.salesReturnId,
        issuePaymentId: p.issuePaymentId,
        issueDate: p.issueDate,
        reason: p.reason,
        reasonDetail: p.reasonDetail,
        notes: p.notes,
        status: p.status,
        subtotal: p.subtotal,
        tax: p.tax,
        total: p.total,
        currency: {
          code: p.currency,
          symbol: p.currency,
          exchangeRate: p.exchangeRate,
        },
        appliedAmount: applied,
        availableCredit: available,
        lines: p.lines,
      });
    }

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + limit < page.total,
      notes: notesWithCredit,
      creditNotes: notesWithCredit,
    };
  }

  async search(request: Parameters<CreditNoteSearcher['run']>[0]): Promise<CreditNoteSearcherResponse> {
    return this.run(request);
  }

  async findById(request: { tenantId: string; creditNoteId: string }): Promise<CreditNoteResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const note = await this.creditNotes.find(tenantId, CreditNoteId.of(request.creditNoteId));
    if (!note) throw new CreditNoteNotFoundError(request.creditNoteId);

    const p = note.toPrimitives();
    const customer = await this.ledger.customer(tenantId, p.customerId);
    const invoice = p.invoiceId ? (await this.ledger.invoices(tenantId, { ids: [p.invoiceId] }))[0] ?? null : null;
    const applied = p.status === 'confirmed' ? await this.creditNotes.appliedPaymentsSum(tenantId, note.id) : 0;
    const available = p.status === 'confirmed' ? NoteCredit.available(p.total, applied) : 0;

    return {
      id: p.id,
      code: p.code,
      customer: { id: p.customerId, name: customer?.name ?? p.customerId },
      invoice: invoice ? { id: invoice.id, code: invoice.code } : null,
      salesReturnId: p.salesReturnId,
      issuePaymentId: p.issuePaymentId,
      issueDate: p.issueDate,
      reason: p.reason,
      reasonDetail: p.reasonDetail,
      notes: p.notes,
      status: p.status,
      subtotal: p.subtotal,
      tax: p.tax,
      total: p.total,
      currency: {
        code: p.currency,
        symbol: p.currency,
        exchangeRate: p.exchangeRate,
      },
      appliedAmount: applied,
      availableCredit: available,
      lines: p.lines,
    };
  }
}
