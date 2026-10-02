import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteCurrencyMismatchError,
  CreditNoteExceededError,
  CreditNoteLineAmountExceedsInvoiceError,
  CreditNoteLineItemMismatchError,
  CreditNoteNotConfirmableError,
  CreditNoteNotConfirmedError,
  CreditNoteNotEditableError,
  CreditNoteNotFoundError,
  CreditNoteReturnAlreadyCreditedError,
  CreditNoteReturnLinesNotFromInvoiceError,
  CreditNoteReturnSupplierMismatchError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteSupplierMismatchError,
  CreditNoteWithApplicationsError,
  InvoiceNotPayableError,
  PayableInvoiceNotFoundError,
  PaymentAlreadyCancelledError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  RevaluationSourceMovementNotFoundError,
} from '../../domain/errors/payables.errors.js';
import { PayableInvoice, PayableInvoicePrimitives } from '../../domain/ledger/payable-invoice.js';
import { PayableInvoiceFilter, PayableSupplier, PayableSupplierFilter, PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PaymentId, PaymentPrimitives, SupplierPayment } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentCriteria, SupplierPaymentPage, SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { SupplierPaymentPosting } from '../../domain/payment/posting/supplier-payment-posting.js';
import {
  CreditNoteReason,
  SupplierCreditNote,
  SupplierCreditNoteId,
  SupplierCreditNotePrimitives,
} from '../../domain/credit-note/supplier-credit-note.entity.js';
import {
  SupplierCreditNoteRepository,
  SupplierCreditNoteSearchFilter,
} from '../../domain/credit-note/supplier-credit-note.repository.js';
import { SupplierCreditNotePosting } from '../../domain/credit-note/posting/supplier-credit-note-posting.js';
import { PayableCreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryInvoiceRevaluationPosting } from '../../../purchasing/infrastructure/testing/in-memory-invoice-revaluation-posting.js';
import { calculatePurchaseDiscountDifference, effectiveRateToBase } from '../../../../shared/domain/purchase-price-difference.js';
import type { InvoiceWarehouseRevaluationData, InvoiceRevaluationLineData } from '../../../../shared/prisma/invoice-revaluation-posting.js';

export interface InMemoryInvoiceLineInfo {
  id: string;
  itemId: string | null;
  itemSku?: string | null;
  itemName?: string | null;
  unitId?: string | null;
  subtotal: number;
  receiptLineId: string | null;
  warehouseId?: string;
  receiptRate?: number;
  sourceMovementId?: string;
  withoutMovement?: boolean;
}

type InvoiceRow = Omit<PayableInvoicePrimitives, 'paid'> & { tenantId: string };

export class InMemoryPayablesStore {
  readonly revaluationPosting: InMemoryInvoiceRevaluationPosting;
  private readonly supplierRows = new Map<string, PayableSupplier & { tenantId: string }>();
  private readonly invoiceRows = new Map<string, InvoiceRow>();
  private readonly paymentRows = new Map<string, PaymentPrimitives>();
  private readonly creditNoteRows = new Map<string, SupplierCreditNotePrimitives>();
  private readonly purchaseReturnRows = new Map<string, { id: string; tenantId: string; supplierId: string; status: string; code?: string; date?: string }>();
  private readonly invoiceLineRows = new Map<string, InMemoryInvoiceLineInfo[]>();
  private readonly returnReceiptLineRows = new Map<string, string[]>();
  private readonly purchaseReturnLineRows = new Map<string, Array<{ id: string; receiptLineId: string; itemId: string; itemSku: string; itemName: string; unitId: string; quantity: number; unitCost: number }>>();
  private readonly amountDecimalsByTenant = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(revaluationPosting?: InMemoryInvoiceRevaluationPosting) {
    this.revaluationPosting = revaluationPosting ?? new InMemoryInvoiceRevaluationPosting();
  }

  setAmountDecimals(tenantId: string, decimals: number): void {
    this.amountDecimalsByTenant.set(tenantId, decimals);
  }

  getAmountDecimals(tenantId: string): number {
    return this.amountDecimalsByTenant.get(tenantId) ?? 2;
  }

  supplier(tenantId: string, supplier: PayableSupplier): void {
    this.supplierRows.set(supplier.id, { ...supplier, tenantId });
  }

  invoice(tenantId: string, invoice: Omit<PayableInvoicePrimitives, 'paid'>): void {
    this.invoiceRows.set(invoice.id, { ...invoice, tenantId });
  }

  setInvoiceLines(invoiceId: string, lines: InMemoryInvoiceLineInfo[]): void {
    this.invoiceLineRows.set(invoiceId, lines);
  }

  setReturnReceiptLines(returnId: string, receiptLineIds: string[]): void {
    this.returnReceiptLineRows.set(returnId, receiptLineIds);
  }

  cancelInvoice(invoiceId: string): void {
    const row = this.invoiceRows.get(invoiceId);
    if (row) this.invoiceRows.set(invoiceId, { ...row, status: 'cancelled' });
  }

  purchaseReturn(
    tenantId: string,
    returnId: string,
    supplierId: string,
    status: string = 'confirmed',
    code: string = 'DVC000001',
    receiptLineIds?: string[],
    lines?: Array<{ id: string; receiptLineId: string; itemId: string; itemSku: string; itemName: string; unitId: string; quantity: number; unitCost: number }>,
    date: string = '2026-09-05',
  ): void {
    this.purchaseReturnRows.set(returnId, { id: returnId, tenantId, supplierId, status, code, date });
    if (receiptLineIds) {
      this.returnReceiptLineRows.set(returnId, receiptLineIds);
    }
    if (lines) {
      this.purchaseReturnLineRows.set(returnId, lines);
    } else if (receiptLineIds) {
      this.purchaseReturnLineRows.set(
        returnId,
        receiptLineIds.map((rlId, idx) => ({
          id: `rtl-${returnId}-${idx}`,
          receiptLineId: rlId,
          itemId: 'item-1',
          itemSku: 'SKU-1',
          itemName: 'Item 1',
          unitId: 'unit-1',
          quantity: 1,
          unitCost: 10,
        })),
      );
    }
  }

  get ledger(): PayablesLedger {
    return {
      suppliers: async (tenantId: TenantId, filter?: PayableSupplierFilter): Promise<PayableSupplier[]> => {
        const text = (filter?.text ?? '').trim().toLowerCase();

        return [...this.supplierRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !text || row.code.toLowerCase().includes(text) || row.name.toLowerCase().includes(text))
          .map(({ tenantId: _, ...supplier }) => supplier);
      },
      supplier: async (tenantId: TenantId, supplierId: string): Promise<PayableSupplier | null> => {
        const row = this.supplierRows.get(supplierId);

        if (!row || row.tenantId !== tenantId.value) return null;

        const { tenantId: _, ...supplier } = row;
        return supplier;
      },
      invoices: async (tenantId: TenantId, filter?: PayableInvoiceFilter): Promise<PayableInvoice[]> => {
        const ids = filter?.ids ? new Set(filter.ids) : null;
        const text = (filter?.text ?? '').trim().toLowerCase();

        return [...this.invoiceRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !filter?.supplierId || row.supplierId === filter.supplierId)
          .filter((row) => !ids || ids.has(row.id))
          .filter((row) => !filter?.onlyConfirmed || row.status === 'confirmed')
          .filter((row) => !filter?.from || row.dueDate >= filter.from)
          .filter((row) => !filter?.to || row.dueDate <= filter.to)
          .filter((row) => !text || row.code.toLowerCase().includes(text))
          .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
          .map((row) => this.hydrateInvoice(row));
      },
      invoiceLines: async (_tenantId: TenantId, invoiceId: string) => {
        return this.invoiceLineRows.get(invoiceId) ?? [];
      },
      returnReceiptLineIds: async (_tenantId: TenantId, returnId: string) => {
        return this.returnReceiptLineRows.get(returnId) ?? [];
      },
      purchaseReturns: async (tenantId: TenantId, returnIds: string[]) => {
        return returnIds
          .map((id) => this.purchaseReturnRows.get(id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r && r.tenantId === tenantId.value))
          .map((r) => ({ id: r.id, code: r.code ?? 'DVC000001' }));
      },
      confirmedReturnsBySupplier: async (tenantId: TenantId, supplierId: string) => {
        return [...this.purchaseReturnRows.values()]
          .filter((r) => r.tenantId === tenantId.value && r.supplierId === supplierId && r.status === 'confirmed')
          .map((r) => ({
            id: r.id,
            code: r.code ?? 'DVC000001',
            date: r.date ?? '2026-09-05',
            supplierId: r.supplierId,
            lines: this.purchaseReturnLineRows.get(r.id) ?? [],
          }));
      },
    };
  }

  get payments(): SupplierPaymentRepository {
    return {
      save: async (payment: SupplierPayment): Promise<void> => {
        const row = payment.toPrimitives();
        const stored = this.paymentRows.get(row.id);

        if (stored && stored.status !== 'draft') throw new PaymentNotEditableError(stored.id, stored.status);
        if (stored && stored.updatedAt.getTime() !== payment.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

        this.paymentRows.set(row.id, structuredClone(row));
      },
      find: async (tenantId: TenantId, id: PaymentId): Promise<SupplierPayment | null> => {
        const row = this.paymentRows.get(id.value);

        if (!row || row.tenantId !== tenantId.value) return null;

        return SupplierPayment.fromPrimitives(row);
      },
      searchByTenant: async (tenantId: TenantId): Promise<SupplierPayment[]> => {
        return [...this.paymentRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => SupplierPayment.fromPrimitives(row));
      },
      searchPage: async (tenantId: TenantId, criteria: SupplierPaymentCriteria): Promise<SupplierPaymentPage> => {
        const text = (criteria.text ?? '').trim().toLowerCase();

        const filtered = [...this.paymentRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !criteria.supplierId || row.supplierId === criteria.supplierId)
          .filter((row) => !criteria.status || row.status === criteria.status)
          .filter((row) => !criteria.from || row.paymentDate >= criteria.from)
          .filter((row) => !criteria.to || row.paymentDate <= criteria.to)
          .filter((row) => !text || row.code.toLowerCase().includes(text) || (row.reference?.toLowerCase().includes(text) ?? false))
          .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.getTime() - a.createdAt.getTime());

        return {
          total: filtered.length,
          payments: filtered.slice(criteria.offset, criteria.offset + criteria.limit).map((row) => SupplierPayment.fromPrimitives(row)),
        };
      },
    };
  }

  get posting(): SupplierPaymentPosting {
    return {
      post: (tenantId: TenantId, paymentId: PaymentId, work: (payment: SupplierPayment, invoices: PayableInvoice[]) => void) =>
        this.serial(async () => {
          const row = this.paymentRows.get(paymentId.value);

          if (!row || row.tenantId !== tenantId.value) throw new PaymentNotFoundError(paymentId.value);

          const payment = SupplierPayment.fromPrimitives(row);
          const invoiceIds = payment.invoiceIds();
          const invoices = invoiceIds.map((id) => {
            const invRow = this.invoiceRows.get(id);
            if (!invRow || invRow.tenantId !== tenantId.value) throw new PayableInvoiceNotFoundError(id);
            return this.hydrateInvoice(invRow, paymentId.value);
          });

          work(payment, invoices);

          const primitives = payment.toPrimitives();
          if (primitives.method === 'credit_note' && primitives.creditSourceId && payment.currentStatus() === 'confirmed') {
            const noteRow = this.creditNoteRows.get(primitives.creditSourceId);
            if (!noteRow || noteRow.tenantId !== tenantId.value) {
              throw new CreditNoteNotFoundError(primitives.creditSourceId);
            }
            if (noteRow.supplierId !== primitives.supplierId) {
              throw new CreditNoteSupplierMismatchError(noteRow.id, primitives.supplierId);
            }
            if (noteRow.status !== 'confirmed') {
              throw new CreditNoteNotConfirmedError(noteRow.code, noteRow.status);
            }
            if (noteRow.currency !== primitives.currency) {
              throw new CreditNoteCurrencyMismatchError(noteRow.currency, primitives.currency);
            }
            const applied = this.appliedSumForNote(noteRow.id, payment.id.value);
            const remaining = PayableCreditQuota.available(noteRow.total, applied);
            if (primitives.amount > remaining) {
              throw new CreditNoteExceededError(noteRow.code, remaining, primitives.amount);
            }
          }

          this.paymentRows.set(paymentId.value, payment.toPrimitives());
        }),
    };
  }

  get creditNotes(): SupplierCreditNoteRepository {
    return {
      save: async (note: SupplierCreditNote): Promise<void> => {
        const row = note.toPrimitives();
        const stored = this.creditNoteRows.get(row.id);

        if (stored && stored.status !== 'draft') throw new CreditNoteNotEditableError(stored.id, stored.status);
        if (stored && stored.updatedAt.getTime() !== note.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

        this.creditNoteRows.set(row.id, structuredClone(row));
      },
      find: async (tenantId: TenantId, id: SupplierCreditNoteId): Promise<SupplierCreditNote | null> => {
        const row = this.creditNoteRows.get(id.value);

        return row && row.tenantId === tenantId.value ? SupplierCreditNote.fromPrimitives(row) : null;
      },
      findByIssuePayment: async (tenantId: TenantId, paymentId: PaymentId): Promise<SupplierCreditNote | null> => {
        const row = [...this.creditNoteRows.values()].find(
          (cn) => cn.tenantId === tenantId.value && cn.issuePaymentId === paymentId.value,
        );
        return row ? SupplierCreditNote.fromPrimitives(row) : null;
      },
      findByIssuePayments: async (tenantId: TenantId, paymentIds: PaymentId[]): Promise<SupplierCreditNote[]> => {
        const set = new Set(paymentIds.map((p) => p.value));
        return [...this.creditNoteRows.values()]
          .filter((row) => row.tenantId === tenantId.value && row.issuePaymentId && set.has(row.issuePaymentId))
          .map((row) => SupplierCreditNote.fromPrimitives(row));
      },
      searchPage: async (tenantId: TenantId, filter: SupplierCreditNoteSearchFilter): Promise<{ notes: SupplierCreditNote[]; total: number }> => {
        const text = filter.text?.toLowerCase() ?? null;
        const matches = [...this.creditNoteRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !filter.supplierId || row.supplierId === filter.supplierId)
          .filter((row) => !filter.invoiceId || row.invoiceId === filter.invoiceId)
          .filter((row) => !filter.purchaseReturnId || row.purchaseReturnId === filter.purchaseReturnId)
          .filter((row) => !filter.status || row.status === filter.status)
          .filter((row) => !filter.from || row.issueDate >= filter.from)
          .filter((row) => !filter.to || row.issueDate <= filter.to)
          .filter((row) => text === null || row.code.toLowerCase().includes(text) || (row.notes ?? '').toLowerCase().includes(text))
          .sort((a, b) => b.code.localeCompare(a.code) || a.id.localeCompare(b.id));

        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 20;

        return {
          notes: matches.slice(offset, offset + limit).map((row) => SupplierCreditNote.fromPrimitives(row)),
          total: matches.length,
        };
      },
      creditedAmountByInvoice: async (tenantId: TenantId, invoiceId: string): Promise<number> => {
        const units = [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.invoiceId === invoiceId && n.status === 'confirmed')
          .reduce((sum, n) => sum + amountUnits(n.total), 0n);

        return unitsToNumber(units);
      },
      creditedAmountByInvoiceLines: async (
        tenantId: TenantId,
        invoiceLineIds: string[],
        excludeNoteId?: SupplierCreditNoteId,
      ): Promise<Map<string, number>> => {
        const map = new Map<string, number>();
        const lineIdSet = new Set(invoiceLineIds);

        for (const note of this.creditNoteRows.values()) {
          if (note.tenantId !== tenantId.value || note.status !== 'confirmed') continue;
          if (excludeNoteId && note.id === excludeNoteId.value) continue;

          for (const l of note.lines) {
            if (l.invoiceLineId && lineIdSet.has(l.invoiceLineId)) {
              map.set(l.invoiceLineId, Number(((map.get(l.invoiceLineId) ?? 0) + l.subtotal).toFixed(4)));
            }
          }
        }

        return map;
      },
      findByIds: async (tenantId: TenantId, ids: SupplierCreditNoteId[]): Promise<SupplierCreditNote[]> => {
        const target = new Set(ids.map((i) => i.value));
        return [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && target.has(n.id))
          .map((n) => SupplierCreditNote.fromPrimitives(n));
      },
      creditedNotesByReturn: async (tenantId: TenantId, purchaseReturnId: string): Promise<SupplierCreditNote[]> => {
        return [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.purchaseReturnId === purchaseReturnId && n.status === 'confirmed')
          .map((n) => SupplierCreditNote.fromPrimitives(n));
      },
      appliedPaymentsSum: async (tenantId: TenantId, noteId: SupplierCreditNoteId, excludePaymentId?: string | null): Promise<number> => {
        return this.appliedSumForNote(noteId.value, excludePaymentId ?? undefined);
      },
      appliedAmountsByNotes: async (tenantId: TenantId, noteIds: SupplierCreditNoteId[], excludePaymentId?: string | null): Promise<Map<string, number>> => {
        const map = new Map<string, number>();
        for (const noteId of noteIds) {
          map.set(noteId.value, this.appliedSumForNote(noteId.value, excludePaymentId ?? undefined));
        }
        return map;
      },
      hasConfirmedPaymentsOtherThan: async (tenantId: TenantId, noteId: SupplierCreditNoteId, excludePaymentId: string | null): Promise<boolean> => {
        return [...this.paymentRows.values()].some(
          (p) => p.tenantId === tenantId.value && p.status === 'confirmed' && p.creditSourceId === noteId.value && p.id !== excludePaymentId,
        );
      },
      findAvailableCreditsBySupplier: async (tenantId: TenantId, supplierId: string): Promise<SupplierCreditNote[]> => {
        const confirmedNotes = [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.supplierId === supplierId && n.status === 'confirmed')
          .map((n) => SupplierCreditNote.fromPrimitives(n));

        return confirmedNotes.filter((note) => {
          const applied = this.appliedSumForNote(note.id.value);
          return PayableCreditQuota.available(note.total(), applied) > 0;
        });
      },
      confirmedCreditedReturnIds: async (tenantId: TenantId): Promise<Set<string>> => {
        const set = new Set<string>();
        for (const cn of this.creditNoteRows.values()) {
          if (cn.tenantId === tenantId.value && cn.purchaseReturnId && cn.status === 'confirmed') {
            set.add(cn.purchaseReturnId);
          }
        }
        return set;
      },
    };
  }

  get creditNotePosting(): SupplierCreditNotePosting {
    return {
      confirm: (
        tenantId: TenantId,
        noteId: SupplierCreditNoteId,
        now: Date,
        today: string,
        userId?: string | null,
      ) =>
        this.serial(async () => {
          const row = this.creditNoteRows.get(noteId.value);

          if (!row || row.tenantId !== tenantId.value) throw new CreditNoteNotFoundError(noteId.value);

          const note = SupplierCreditNote.fromPrimitives(row);
          if (note.currentStatus() !== 'draft') {
            throw new CreditNoteNotConfirmableError(noteId.value, note.currentStatus());
          }

          let issuePayment: SupplierPayment | null = null;

          if (note.invoiceId()) {
            const invoiceId = note.invoiceId()!;
            const invoiceRow = this.invoiceRows.get(invoiceId);
            if (!invoiceRow || invoiceRow.tenantId !== tenantId.value) throw new PayableInvoiceNotFoundError(invoiceId);
            if (invoiceRow.status !== 'confirmed') {
              throw new InvoiceNotPayableError(invoiceId);
            }

            const invoice = this.hydrateInvoice(invoiceRow);
            const invoiceLines = this.invoiceLineRows.get(invoiceId) ?? [];
            const invLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));

            if (!note.purchaseReturnId()) {
              const creditedByLineId = await this.creditNotes.creditedAmountByInvoiceLines(
                tenantId,
                [...invLinesMap.keys()],
                note.id,
              );
              const consumedInSameNote = new Map<string, number>();

              for (const line of note.toPrimitives().lines) {
                if (!line.invoiceLineId) continue;
                const invLine = invLinesMap.get(line.invoiceLineId);
                if (!invLine) continue;

                if (invLine.itemId && line.itemId && line.itemId !== invLine.itemId) {
                  throw new CreditNoteLineItemMismatchError(
                    line.id,
                    invLine.itemId,
                    line.itemId,
                  );
                }
                if (invLine.itemId && !line.itemId) {
                  throw new CreditNoteLineItemMismatchError(
                    line.id,
                    invLine.itemId,
                    'none',
                  );
                }

                const lineSubtotal = Number(line.subtotal);
                const priorConfirmed = creditedByLineId.get(line.invoiceLineId) ?? 0;
                const sameNoteSoFar = consumedInSameNote.get(line.invoiceLineId) ?? 0;
                const totalAttempted = priorConfirmed + sameNoteSoFar + lineSubtotal;
                const invLineSubtotal = Number(invLine.subtotal);

                if (totalAttempted > invLineSubtotal + 1e-4) {
                  throw new CreditNoteLineAmountExceedsInvoiceError(
                    line.id,
                    totalAttempted,
                    invLineSubtotal,
                  );
                }

                consumedInSameNote.set(line.invoiceLineId, sameNoteSoFar + lineSubtotal);
              }
            }

            const credited = await this.creditNotes.creditedAmountByInvoice(tenantId, invoiceId);
            PayableCreditQuota.ensureWithinQuota(invoice.total(), credited, note.total(), invoiceId);

            const balance = invoice.balance();
            if (balance > 0) {
              const applyAmount = Math.min(balance, note.total());
              const paymentId = PaymentId.of(crypto.randomUUID());
              const allocId = crypto.randomUUID();
              const paymentCode = `PAG${String(this.paymentRows.size + 1).padStart(6, '0')}`;
              const notePrimitives = note.toPrimitives();

              const paymentDetails = {
                supplierId: note.supplierId(),
                date: note.issueDate(),
                method: 'credit_note' as const,
                creditSourceId: note.id.value,
                reference: `Nota ${note.code}`,
                notes: `Pago automatico por emision de nota ${note.code}`,
                allocations: [{ id: allocId, invoiceId, amount: applyAmount }],
              };

              const invoiceRates = { [invoice.currency().currency]: notePrimitives.exchangeRate ?? 1 };
              const paymentRatesObj = {
                currency: note.currency(),
                invoiceRates,
                decimals: this.getAmountDecimals(tenantId.value),
              };

              issuePayment = SupplierPayment.draft(
                paymentId,
                tenantId,
                paymentCode,
                paymentDetails,
                [invoice],
                paymentRatesObj,
                now,
                today,
              );
              issuePayment.confirm([invoice], paymentRatesObj, now, today);
              this.paymentRows.set(paymentId.value, issuePayment.toPrimitives());
              note.assignIssuePayment(paymentId.value);
            }
          }

          if (note.purchaseReturnId()) {
            const returnId = note.purchaseReturnId()!;
            const ret = this.purchaseReturnRows.get(returnId);

            if (!ret || ret.tenantId !== tenantId.value || ret.status !== 'confirmed') {
              throw new CreditNoteReturnNotConfirmedError(returnId, ret?.status ?? 'none');
            }

            if (ret.supplierId !== note.supplierId()) {
              throw new CreditNoteReturnSupplierMismatchError(returnId, note.supplierId());
            }

            const existing = await this.creditNotes.creditedNotesByReturn(tenantId, returnId);
            if (existing.length > 0) {
              throw new CreditNoteReturnAlreadyCreditedError(returnId);
            }

            if (note.invoiceId()) {
              const invoiceLines = this.invoiceLineRows.get(note.invoiceId()!) ?? [];
              const returnLines = this.returnReceiptLineRows.get(returnId) ?? [];
              const invoiceReceiptLineIds = new Set(invoiceLines.map((il) => il.receiptLineId).filter(Boolean));
              if (returnLines.length > 0 && returnLines.some((rId) => !invoiceReceiptLineIds.has(rId))) {
                throw new CreditNoteReturnLinesNotFromInvoiceError(returnId, note.invoiceId()!);
              }
            }
          }

          let totalPriceDifference = 0;
          let totalExchangeDifference = 0;
          const revaluationsByWarehouse = new Map<string, InvoiceRevaluationLineData[]>();

          if (note.invoiceId() && !note.purchaseReturnId()) {
            const invoiceLines = this.invoiceLineRows.get(note.invoiceId()!) ?? [];
            const invLinesMap = new Map(invoiceLines.map((il) => [il.id, il]));
            const notePrimitives = note.toPrimitives();
            const linesWithInvoice = notePrimitives.lines.filter((l) => Boolean(l.invoiceLineId));
            const noteRate = effectiveRateToBase(
              notePrimitives.currency,
              notePrimitives.baseCurrency,
              notePrimitives.exchangeRate,
              notePrimitives.baseExchangeRate,
            );

            const discountCalc = calculatePurchaseDiscountDifference(
              linesWithInvoice.map((l) => {
                const invLine = invLinesMap.get(l.invoiceLineId!);
                const receiptRate = invLine?.receiptRate ?? 1;
                return {
                  subtotal: Number(l.subtotal),
                  noteRate,
                  receiptRate,
                };
              }),
            );

            totalPriceDifference = discountCalc.priceDifference;
            totalExchangeDifference = discountCalc.exchangeDifference;

            for (let i = 0; i < linesWithInvoice.length; i++) {
              const l = linesWithInvoice[i];
              const invLine = invLinesMap.get(l.invoiceLineId!);
              const warehouseId = invLine?.warehouseId ?? 'wh-001';
              const amountBase = discountCalc.lineDifferences[i].priceDifferenceBase;

              const sourceMovementId = invLine?.withoutMovement
                ? undefined
                : (invLine?.sourceMovementId ?? `mov-${invLine?.receiptLineId ?? l.id}`);
              if (!sourceMovementId) {
                throw new RevaluationSourceMovementNotFoundError(invLine?.receiptLineId ?? l.invoiceLineId!);
              }
              const whLines = revaluationsByWarehouse.get(warehouseId) ?? [];
              whLines.push({
                lineNumber: whLines.length + 1,
                itemId: l.itemId ?? invLine?.itemId ?? 'item-001',
                itemSku: l.itemSku ?? invLine?.itemSku ?? 'SKU-001',
                itemName: l.itemName ?? invLine?.itemName ?? 'Item',
                unitId: invLine?.unitId ?? 'unit-001',
                amount: amountBase,
                sourceMovementId,
                reason: `Rebaja de precio segun nota de credito ${note.code}`,
              });
              revaluationsByWarehouse.set(warehouseId, whLines);
            }

            if (revaluationsByWarehouse.size > 0) {
              const revalData: InvoiceWarehouseRevaluationData[] = [...revaluationsByWarehouse.entries()].map(
                ([warehouseId, revalLines]) => ({ warehouseId, lines: revalLines }),
              );
              await this.revaluationPosting.createDraftRevaluations(
                tenantId,
                note.id.value,
                note.code,
                notePrimitives.issueDate,
                revalData,
                now,
                today,
                userId ?? null,
                undefined,
                'supplier_credit_note',
              );
            }
          }

          note.confirm(now, issuePayment ? issuePayment.id.value : null, totalPriceDifference, totalExchangeDifference);
          this.creditNoteRows.set(note.id.value, note.toPrimitives());

          return { creditNote: note, issuePayment };
        }),

      cancel: (tenantId: TenantId, noteId: SupplierCreditNoteId, now: Date, userId?: string | null) =>
        this.serial(async () => {
          const row = this.creditNoteRows.get(noteId.value);

          if (!row || row.tenantId !== tenantId.value) throw new CreditNoteNotFoundError(noteId.value);

          const note = SupplierCreditNote.fromPrimitives(row);
          if (note.currentStatus() === 'cancelled') {
            throw new CreditNoteAlreadyCancelledError(noteId.value);
          }

          const hasExternal = await this.creditNotes.hasConfirmedPaymentsOtherThan(
            tenantId,
            note.id,
            note.issuePaymentId(),
          );
          if (hasExternal) {
            throw new CreditNoteWithApplicationsError(note.id.value);
          }

          if (note.issuePaymentId()) {
            const issuePaymentRow = this.paymentRows.get(note.issuePaymentId()!);
            if (issuePaymentRow && issuePaymentRow.status === 'confirmed') {
              const payment = SupplierPayment.fromPrimitives(issuePaymentRow);
              payment.cancel(now);
              this.paymentRows.set(payment.id.value, payment.toPrimitives());
            }
          }

          await this.revaluationPosting.cancelOrReverseRevaluations(
            tenantId,
            note.id.value,
            note.code,
            now,
            now.toISOString().slice(0, 10),
            userId ?? null,
            undefined,
            'supplier_credit_note',
          );

          note.cancel(now);
          this.creditNoteRows.set(note.id.value, note.toPrimitives());
        }),
    };
  }

  private hydrateInvoice(row: InvoiceRow, excludedPaymentId?: string): PayableInvoice {
    let paid = 0n;

    for (const payment of this.paymentRows.values()) {
      if (payment.tenantId !== row.tenantId) continue;
      if (payment.status !== 'confirmed') continue;
      if (excludedPaymentId && payment.id === excludedPaymentId) continue;

      for (const allocation of payment.allocations) {
        if (allocation.invoiceId === row.id) {
          paid += amountUnits(allocation.amount);
        }
      }
    }

    const { tenantId: _, ...primitives } = row;
    return PayableInvoice.of({
      ...primitives,
      paid: unitsToNumber(paid),
    });
  }

  private appliedSumForNote(noteId: string, excludePaymentId?: string): number {
    const units = [...this.paymentRows.values()]
      .filter((p) => p.status === 'confirmed' && p.creditSourceId === noteId && p.id !== excludePaymentId)
      .reduce((sum, p) => sum + amountUnits(p.amount), 0n);

    return unitsToNumber(units);
  }

  private serial<T = void>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
