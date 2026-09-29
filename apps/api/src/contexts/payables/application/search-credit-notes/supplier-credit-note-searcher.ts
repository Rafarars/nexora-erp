import { CreditNoteNotFoundError, PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import {
  CreditNoteReason,
  CreditNoteStatus,
  SupplierCreditNoteId,
  SupplierCreditNoteLinePrimitives,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import { SupplierCreditNoteRepository } from '../../domain/credit-note/supplier-credit-note.repository.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SupplierCreditNoteResponse {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  invoice: { id: string; code: string } | null;
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
  currency: {
    code: string;
    symbol: string;
    exchangeRate: number | null;
  };
  appliedAmount: number;
  availableCredit: number;
  priceDifference: number;
  exchangeDifference: number;
  lines: SupplierCreditNoteLinePrimitives[];
}

export interface SupplierCreditNoteSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  notes: SupplierCreditNoteResponse[];
  creditNotes: SupplierCreditNoteResponse[];
}

const DEFAULT_PAGE = 20;

export class SupplierCreditNoteSearcher {
  constructor(
    private readonly creditNotes: SupplierCreditNoteRepository,
    private readonly ledger: PayablesLedger,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    supplierId?: string | null;
    invoiceId?: string | null;
    status?: string | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<SupplierCreditNoteSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.supplierId) {
      const supplier = await this.ledger.supplier(tenantId, request.supplierId);
      if (!supplier) throw new PayableSupplierNotFoundError(request.supplierId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;

    const page = await this.creditNotes.searchPage(tenantId, {
      supplierId: request.supplierId ?? undefined,
      invoiceId: request.invoiceId ?? undefined,
      status: request.status ?? undefined,
      from: request.from ?? undefined,
      to: request.to ?? undefined,
      text: request.q?.trim() ? request.q.trim() : undefined,
      limit,
      offset,
    });

    const rows = page.notes.map((n) => n.toPrimitives());
    const supplierIds = [...new Set(rows.map((n) => n.supplierId))];
    const invoiceIds = [...new Set(rows.map((n) => n.invoiceId).filter((id): id is string => id !== null))];

    const [suppliers, invoices] = await Promise.all([
      this.ledger.suppliers(tenantId),
      this.ledger.invoices(tenantId, { ids: invoiceIds }),
    ]);

    const supplierMap = new Map(suppliers.filter((s) => supplierIds.includes(s.id)).map((s) => [s.id, s]));
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv.toPrimitives()]));

    const appliedMap = await this.creditNotes.appliedAmountsByNotes(
      tenantId,
      page.notes.filter((n) => n.currentStatus() === 'confirmed').map((n) => n.id),
    );

    const notesWithCredit: SupplierCreditNoteResponse[] = [];

    for (const note of page.notes) {
      const p = note.toPrimitives();
      const supplier = supplierMap.get(p.supplierId);
      const invoice = p.invoiceId ? invoiceMap.get(p.invoiceId) : null;
      const applied = p.status === 'confirmed' ? (appliedMap.get(note.id.value) ?? 0) : 0;
      const available = p.status === 'confirmed' ? PayableCreditQuota.available(p.total, applied) : 0;

      notesWithCredit.push({
        id: p.id,
        code: p.code,
        supplier: { id: p.supplierId, name: supplier?.name ?? p.supplierId },
        invoice: invoice ? { id: invoice.id, code: invoice.code } : null,
        purchaseReturnId: p.purchaseReturnId,
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
        priceDifference: p.priceDifference,
        exchangeDifference: p.exchangeDifference,
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

  async search(request: Parameters<SupplierCreditNoteSearcher['run']>[0]): Promise<SupplierCreditNoteSearcherResponse> {
    return this.run(request);
  }

  async findById(request: { tenantId: string; creditNoteId: string }): Promise<SupplierCreditNoteResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const note = await this.creditNotes.find(tenantId, SupplierCreditNoteId.of(request.creditNoteId));
    if (!note) throw new CreditNoteNotFoundError(request.creditNoteId);

    const p = note.toPrimitives();
    const supplier = await this.ledger.supplier(tenantId, p.supplierId);
    const invoice = p.invoiceId ? (await this.ledger.invoices(tenantId, { ids: [p.invoiceId] }))[0]?.toPrimitives() ?? null : null;
    const applied = p.status === 'confirmed' ? await this.creditNotes.appliedPaymentsSum(tenantId, note.id) : 0;
    const available = p.status === 'confirmed' ? PayableCreditQuota.available(p.total, applied) : 0;

    return {
      id: p.id,
      code: p.code,
      supplier: { id: p.supplierId, name: supplier?.name ?? p.supplierId },
      invoice: invoice ? { id: invoice.id, code: invoice.code } : null,
      purchaseReturnId: p.purchaseReturnId,
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
      priceDifference: p.priceDifference,
      exchangeDifference: p.exchangeDifference,
      lines: p.lines,
    };
  }
}
