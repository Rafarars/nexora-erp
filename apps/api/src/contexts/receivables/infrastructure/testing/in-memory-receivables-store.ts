import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteCustomerMismatchError,
  CreditNoteExceededError,
  CreditNoteNotConfirmableError,
  CreditNoteNotConfirmedError,
  CreditNoteNotEditableError,
  CreditNoteNotFoundError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteWithApplicationsError,
  IssuePaymentCannotBeCancelledDirectlyError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  ReceivableInvoiceNotFoundError,
} from '../../domain/errors/receivables.errors.js';
import { ReceivableInvoice, ReceivableInvoicePrimitives } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer, ReceivableInvoiceFilter, ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerPayment, PaymentId, PaymentPrimitives } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import { CustomerCreditNote, CustomerCreditNotePrimitives } from '../../domain/credit-note/customer-credit-note.entity.js';
import { CustomerCreditNoteRepository } from '../../domain/credit-note/customer-credit-note.repository.js';
import { CreditNotePosting } from '../../domain/credit-note/posting/credit-note-posting.js';
import { CreditQuota } from '../../domain/credit-note/credit-quota.service.js';
import { NoteCredit } from '../../domain/credit-note/note-credit.service.js';

type InvoiceRow = Omit<ReceivableInvoicePrimitives, 'paid'> & { tenantId: string };

// Clientes y facturas de ventas mas los cobros y notas de credito, en un solo almacen: lo cobrado
// de una factura sale de los cobros confirmados, como en la base. Las publicaciones van de una en
// una y una que falla no deja nada escrito.
export class InMemoryReceivablesStore {
  private readonly customerRows = new Map<string, ReceivableCustomer & { tenantId: string }>();
  private readonly invoiceRows = new Map<string, InvoiceRow>();
  private readonly paymentRows = new Map<string, PaymentPrimitives>();
  private readonly creditNoteRows = new Map<string, CustomerCreditNotePrimitives>();
  private queue: Promise<unknown> = Promise.resolve();

  customer(tenantId: string, customer: ReceivableCustomer): void {
    this.customerRows.set(customer.id, { ...customer, tenantId });
  }

  invoice(tenantId: string, invoice: Omit<ReceivableInvoicePrimitives, 'paid'>): void {
    this.invoiceRows.set(invoice.id, { ...invoice, tenantId });
  }

  // Simula que ventas anula la factura.
  cancelInvoice(invoiceId: string): void {
    const row = this.invoiceRows.get(invoiceId);

    if (row) this.invoiceRows.set(invoiceId, { ...row, status: 'cancelled' });
  }

  get ledger(): ReceivablesLedger {
    return {
      customers: async (tenantId, filter = {}) => {
        const text = filter.text?.toLowerCase() ?? null;

        return [...this.customerRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => text === null || row.code.toLowerCase().includes(text) || row.name.toLowerCase().includes(text))
          .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code))
          .map(({ tenantId: _tenant, ...customer }) => ({ ...customer }));
      },
      customer: async (tenantId, customerId) => {
        const row = this.customerRows.get(customerId);

        if (!row || row.tenantId !== tenantId.value) return null;

        const { tenantId: _tenant, ...customer } = row;

        return { ...customer };
      },
      invoices: async (tenantId, filter = {}) => this.invoicesOf(tenantId.value, filter),
    };
  }

  get payments(): PaymentRepository {
    return {
      save: async (payment) => {
        const row = payment.toPrimitives();
        const stored = this.paymentRows.get(row.id);

        if (stored && stored.status !== 'draft') throw new PaymentNotEditableError(stored.id, stored.status);
        if (stored && stored.updatedAt.getTime() !== payment.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

        this.paymentRows.set(row.id, row);
      },
      find: async (tenantId, id) => {
        const row = this.paymentRows.get(id.value);

        return row && row.tenantId === tenantId.value ? CustomerPayment.fromPrimitives(row) : null;
      },
      searchByTenant: async (tenantId) =>
        [...this.paymentRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => b.code.localeCompare(a.code))
          .map((row) => CustomerPayment.fromPrimitives(row)),
      searchPage: async (tenantId, criteria) => {
        const text = criteria.text?.toLowerCase() ?? null;
        const matches = [...this.paymentRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !criteria.customerId || row.customerId === criteria.customerId)
          .filter((row) => !criteria.status || row.status === criteria.status)
          .filter((row) => !criteria.from || row.paymentDate >= criteria.from)
          .filter((row) => !criteria.to || row.paymentDate <= criteria.to)
          .filter((row) => text === null || row.code.toLowerCase().includes(text) || (row.reference ?? '').toLowerCase().includes(text))
          .sort((a, b) => b.code.localeCompare(a.code) || a.id.localeCompare(b.id));

        return {
          payments: matches.slice(criteria.offset, criteria.offset + criteria.limit).map((row) => CustomerPayment.fromPrimitives(row)),
          total: matches.length,
        };
      },
    };
  }

  get posting(): PaymentPosting {
    return {
      post: (tenantId, paymentId, work) =>
        this.serial(async () => {
          const row = this.paymentRows.get(paymentId.value);

          if (!row || row.tenantId !== tenantId.value) throw new PaymentNotFoundError(paymentId.value);

          const payment = CustomerPayment.fromPrimitives(row);
          const previousStatus = payment.currentStatus();
          const invoices = this.invoicesOf(tenantId.value, { ids: payment.invoiceIds() }, payment.id.value);

          await work(payment, invoices);

          // Si se anula un cobro que es cobro de emision de una nota, se rechaza
          const isIssuePayment = [...this.creditNoteRows.values()].find(
            (cn) => cn.tenantId === tenantId.value && cn.issuePaymentId === payment.id.value,
          );
          if (isIssuePayment && previousStatus === 'confirmed' && payment.currentStatus() === 'cancelled') {
            throw new IssuePaymentCannotBeCancelledDirectlyError(payment.toPrimitives().code, isIssuePayment.id);
          }

          // Si el cobro usa credit_note, validar la nota de credito bajo bloqueo
          const primitives = payment.toPrimitives();
          if (primitives.method === 'credit_note' && primitives.creditSourceId && payment.currentStatus() === 'confirmed') {
            const noteRow = this.creditNoteRows.get(primitives.creditSourceId);
            if (!noteRow || noteRow.tenantId !== tenantId.value) {
              throw new CreditNoteNotFoundError(primitives.creditSourceId);
            }
            if (noteRow.customerId !== primitives.customerId) {
              throw new CreditNoteCustomerMismatchError(noteRow.id, primitives.customerId);
            }
            if (noteRow.status !== 'confirmed') {
              throw new CreditNoteNotConfirmedError(noteRow.code, noteRow.status);
            }
            const applied = this.appliedSumForNote(noteRow.id, payment.id.value);
            const remaining = NoteCredit.available(noteRow.total, applied);
            if (primitives.amount > remaining) {
              throw new CreditNoteExceededError(noteRow.code, remaining, primitives.amount);
            }
          }

          this.paymentRows.set(row.id, payment.toPrimitives());
        }),
    };
  }

  get creditNotes(): CustomerCreditNoteRepository {
    return {
      save: async (note) => {
        const row = note.toPrimitives();
        const stored = this.creditNoteRows.get(row.id);

        if (stored && stored.status !== 'draft') throw new CreditNoteNotEditableError(stored.id, stored.status);
        if (stored && stored.updatedAt.getTime() !== note.version()?.getTime()) throw new ConcurrentModificationError(stored.id);

        this.creditNoteRows.set(row.id, row);
      },
      find: async (tenantId, id) => {
        const row = this.creditNoteRows.get(id.value);

        return row && row.tenantId === tenantId.value ? CustomerCreditNote.fromPrimitives(row) : null;
      },
      searchPage: async (tenantId, filter) => {
        const text = filter.text?.toLowerCase() ?? null;
        const matches = [...this.creditNoteRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .filter((row) => !filter.customerId || row.customerId === filter.customerId)
          .filter((row) => !filter.invoiceId || row.invoiceId === filter.invoiceId)
          .filter((row) => !filter.salesReturnId || row.salesReturnId === filter.salesReturnId)
          .filter((row) => !filter.status || row.status === filter.status)
          .filter((row) => !filter.from || row.issueDate >= filter.from)
          .filter((row) => !filter.to || row.issueDate <= filter.to)
          .filter((row) => text === null || row.code.toLowerCase().includes(text) || (row.notes ?? '').toLowerCase().includes(text))
          .sort((a, b) => b.code.localeCompare(a.code) || a.id.localeCompare(b.id));

        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 20;

        return {
          notes: matches.slice(offset, offset + limit).map((row) => CustomerCreditNote.fromPrimitives(row)),
          total: matches.length,
        };
      },
      creditedAmountByInvoice: async (tenantId, invoiceId) => {
        const units = [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.invoiceId === invoiceId && n.status === 'confirmed')
          .reduce((sum, n) => sum + amountUnits(n.total), 0n);

        return unitsToNumber(units);
      },
      creditedNotesByReturn: async (tenantId, salesReturnId) => {
        return [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.salesReturnId === salesReturnId && n.status === 'confirmed')
          .map((n) => CustomerCreditNote.fromPrimitives(n));
      },
      appliedPaymentsSum: async (tenantId, noteId) => {
        return this.appliedSumForNote(noteId.value);
      },
      hasConfirmedPaymentsOtherThan: async (tenantId, noteId, excludePaymentId) => {
        return [...this.paymentRows.values()].some(
          (p) => p.tenantId === tenantId.value && p.status === 'confirmed' && p.creditSourceId === noteId.value && p.id !== excludePaymentId,
        );
      },
      findAvailableCreditsByCustomer: async (tenantId, customerId) => {
        const confirmedNotes = [...this.creditNoteRows.values()]
          .filter((n) => n.tenantId === tenantId.value && n.customerId === customerId && n.status === 'confirmed')
          .map((n) => CustomerCreditNote.fromPrimitives(n));

        return confirmedNotes.filter((note) => {
          const applied = this.appliedSumForNote(note.id.value);
          return NoteCredit.available(note, applied) > 0;
        });
      },
    };
  }

  get creditNotePosting(): CreditNotePosting {
    return {
      confirm: (tenantId, noteId, now, today) =>
        this.serial(async () => {
          const row = this.creditNoteRows.get(noteId.value);

          if (!row || row.tenantId !== tenantId.value) throw new CreditNoteNotFoundError(noteId.value);

          const note = CustomerCreditNote.fromPrimitives(row);
          if (note.currentStatus() !== 'draft') {
            throw new CreditNoteNotConfirmableError(noteId.value, note.currentStatus());
          }

          let issuePayment: CustomerPayment | null = null;

          if (note.invoiceId()) {
            const invoiceId = note.invoiceId()!;
            const invoice = (this.invoicesOf(tenantId.value, { ids: [invoiceId] }))[0];
            if (!invoice) throw new ReceivableInvoiceNotFoundError(invoiceId);

            const credited = await this.creditNotes.creditedAmountByInvoice(tenantId, invoiceId);
            CreditQuota.ensureWithinQuota(invoice.toPrimitives().total, credited, note.total(), invoiceId);

            const balance = invoice.balance();
            if (balance > 0) {
              const applyAmount = Math.min(balance, note.total());
              const paymentId = PaymentId.of(`cb000000-0000-4000-8000-${String(this.paymentRows.size + 1).padStart(12, '0')}`);
              const allocId = `ca000000-0000-4000-8000-${String(this.paymentRows.size + 1).padStart(12, '0')}`;
              const paymentCode = `COB${String(this.paymentRows.size + 1).padStart(6, '0')}`;
              const notePrimitives = note.toPrimitives();

              const paymentDetails = {
                customerId: note.customerId(),
                date: note.issueDate(),
                method: 'credit_note' as const,
                creditSourceId: note.id.value,
                reference: `Nota ${note.code}`,
                notes: `Cobro automatico por emision de nota ${note.code}`,
                allocations: [{ id: allocId, invoiceId, amount: applyAmount }],
              };

              const invoiceRates = { [invoice.currency().currency]: notePrimitives.exchangeRate ?? 1 };
              const paymentRatesObj = {
                currency: note.currency(),
                invoiceRates,
                decimals: 2,
              };

              issuePayment = CustomerPayment.draft(
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

          if (note.salesReturnId()) {
            const returnId = note.salesReturnId()!;
            const existing = await this.creditNotes.creditedNotesByReturn(tenantId, returnId);
            if (existing.length > 0) {
              throw new CreditNoteReturnNotConfirmedError(returnId, 'already_credited');
            }
          }

          note.confirm(now, issuePayment ? issuePayment.id.value : null);
          this.creditNoteRows.set(note.id.value, note.toPrimitives());

          return { creditNote: note, issuePayment };
        }),

      cancel: (tenantId, noteId, now) =>
        this.serial(async () => {
          const row = this.creditNoteRows.get(noteId.value);

          if (!row || row.tenantId !== tenantId.value) throw new CreditNoteNotFoundError(noteId.value);

          const note = CustomerCreditNote.fromPrimitives(row);
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
              const payment = CustomerPayment.fromPrimitives(issuePaymentRow);
              payment.cancel(now);
              this.paymentRows.set(payment.id.value, payment.toPrimitives());
            }
          }

          note.cancel(now);
          this.creditNoteRows.set(note.id.value, note.toPrimitives());
        }),
    };
  }

  private invoicesOf(tenantId: string, filter: ReceivableInvoiceFilter, excludedPayment?: string): ReceivableInvoice[] {
    const text = filter.text?.toLowerCase() ?? null;
    const nameOf = (customerId: string) => this.customerRows.get(customerId)?.name ?? '';

    return [...this.invoiceRows.values()]
      .filter((row) => row.tenantId === tenantId && (!filter.customerId || row.customerId === filter.customerId) && (!filter.ids || filter.ids.includes(row.id)))
      .filter((row) => !filter.onlyIssued || row.status === 'issued')
      .filter((row) => !filter.from || row.dueDate >= filter.from)
      .filter((row) => !filter.to || row.dueDate <= filter.to)
      .filter((row) => text === null || row.code.toLowerCase().includes(text) || nameOf(row.customerId).toLowerCase().includes(text))
      .sort((a, b) => b.code.localeCompare(a.code))
      .map(({ tenantId: _tenant, ...row }) => ReceivableInvoice.of({ ...row, paid: this.paidOf(row.id, excludedPayment) }));
  }

  private paidOf(invoiceId: string, excludedPayment?: string): number {
    const units = [...this.paymentRows.values()]
      .filter((payment) => payment.status === 'confirmed' && payment.id !== excludedPayment)
      .flatMap((payment) => payment.allocations)
      .filter((allocation) => allocation.invoiceId === invoiceId)
      .reduce((sum, allocation) => sum + amountUnits(allocation.amount), 0n);

    return unitsToNumber(units);
  }

  private appliedSumForNote(noteId: string, excludePaymentId?: string): number {
    const units = [...this.paymentRows.values()]
      .filter((p) => p.status === 'confirmed' && p.creditSourceId === noteId && p.id !== excludePaymentId)
      .flatMap((p) => p.allocations)
      .reduce((sum, a) => sum + amountUnits(a.amount), 0n);

    return unitsToNumber(units);
  }

  // En serie, como el bloqueo de filas de la base.
  private serial<T = void>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
