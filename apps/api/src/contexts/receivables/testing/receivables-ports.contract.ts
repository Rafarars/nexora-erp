import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConcurrentModificationError } from '../../../shared/domain/concurrent-modification.error.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteExceededError,
  CreditNoteNotConfirmedError,
  CreditNoteNotEditableError,
  CreditNoteReturnAlreadyCreditedError,
  CreditNoteReturnNotConfirmedError,
  CreditNoteReturnOrderMismatchError,
  CreditNoteWithApplicationsError,
  CreditQuotaExceededError,
  InvoiceNotPayableError,
  IssuePaymentCannotBeCancelledDirectlyError,
  PaymentAlreadyCancelledError,
  PaymentExceedsBalanceError,
  PaymentNotEditableError,
  PaymentNotFoundError,
} from '../domain/errors/receivables.errors.js';
import { SalesReturnWithCreditNoteError } from '../../sales/domain/errors/sales.errors.js';
import { CustomerPayment, PaymentDetails, PaymentId } from '../domain/payment/customer-payment.entity.js';
import { CreditNoteId, CustomerCreditNote } from '../domain/credit-note/customer-credit-note.entity.js';
import { NoteCredit } from '../domain/credit-note/note-credit.service.js';
import { ReceivablesDate } from '../domain/shared/receivables-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CUSTOMER, DOLLARS, INVOICE, NOW, OTHER_CUSTOMER, OTHER_INVOICE, TENANT_A, TENANT_B, TODAY, aPaymentRates } from '../domain/testing/receivables.mother.js';
import { PaymentCanceller } from '../application/cancel-payment/payment-canceller.js';
import { ReceivablesPorts, ReceivablesPortsHarness } from './receivables-ports.harness.js';

const tenant = TenantId.of(TENANT_A);
const FOREIGN_CUSTOMER = 'c9999999-9999-4999-8999-999999999999';
const FOREIGN_INVOICE = 'f9999999-9999-4999-8999-999999999999';

// UNA suite para el doble y para PostgreSQL. Lo que importa: que dos cobros simultaneos no cobren
// una factura de mas, que lo cobrado cuente solo lo confirmado y que nada cruce de empresa.
export function describeReceivablesPortsContract(implementation: string, createHarness: () => ReceivablesPortsHarness): void {
  describe(`Receivables ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: ReceivablesPorts;
    let counter = 0;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
      await harness.customer(TENANT_A, { id: CUSTOMER, code: 'CLI900001', name: 'Contrato Delta', paymentTermDays: 15, creditLimit: 500.5, isActive: true });
      await harness.customer(TENANT_A, { id: OTHER_CUSTOMER, code: 'CLI900002', name: 'Contrato Omega', paymentTermDays: 0, creditLimit: null, isActive: false });
      await harness.customer(TENANT_B, { id: FOREIGN_CUSTOMER, code: 'CLI900001', name: 'Contrato ajeno', paymentTermDays: 0, creditLimit: null, isActive: true });
      await harness.invoice(TENANT_A, { id: INVOICE, code: 'FAC900002', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 100, ...DOLLARS });
      await harness.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FAC900001', customerId: OTHER_CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'issued', total: 30.3, ...DOLLARS });
      await harness.invoice(TENANT_B, { id: FOREIGN_INVOICE, code: 'FAC900001', customerId: FOREIGN_CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'issued', total: 10, ...DOLLARS });
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    const next = () => String((counter += 1)).padStart(12, '0');
    const allocation = (invoiceId: string, amount: number): PaymentDetails['allocations'][number] => ({ id: `da000000-0000-4000-8000-${next()}`, invoiceId, amount });

    async function draft(allocations: PaymentDetails['allocations'], customerId = CUSTOMER): Promise<PaymentId> {
      const id = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);
      const invoices = await ports.ledger.invoices(tenant, { ids: allocations.map((row) => row.invoiceId) });

      await ports.payments.save(
        CustomerPayment.draft(id, tenant, `COB${next().slice(-6)}`, { customerId, date: ReceivablesDate.of(TODAY), method: 'transfer', reference: 'TRF', notes: 'contrato', allocations }, invoices, aPaymentRates(), NOW, TODAY),
      );

      return id;
    }

    const confirm = (id: PaymentId) => ports.posting.post(tenant, id, (payment, invoices) => payment.confirm(invoices, aPaymentRates(), NOW, TODAY));
    const cancel = (id: PaymentId) => new PaymentCanceller(ports.posting, ports.creditNotes, { now: () => NOW }).run({ tenantId: TENANT_A, paymentId: id.value });
    const invoice = async (id = INVOICE) => (await ports.ledger.invoices(tenant, { ids: [id] }))[0];

    async function draftNote(params: {
      customerId?: string;
      invoiceId?: string | null;
      salesReturnId?: string | null;
      total: number;
      decimals?: number;
    }): Promise<CreditNoteId> {
      const id = CreditNoteId.of(`cc000000-0000-4000-8000-${next()}`);
      const code = `NCC${next().slice(-6)}`;
      const note = CustomerCreditNote.draft(
        id,
        tenant,
        code,
        {
          customerId: params.customerId ?? CUSTOMER,
          invoiceId: params.invoiceId ?? null,
          salesReturnId: params.salesReturnId ?? null,
          issueDate: ReceivablesDate.of(TODAY),
          reason: 'subsequent_discount',
          reasonDetail: null,
          notes: 'contrato nota',
          currency: DocumentCurrency.fromPrimitives({
            currency: 'USD',
            exchangeRate: 1,
            baseCurrency: 'USD',
            baseExchangeRate: 1,
            manualExchangeRate: false,
          }),
          lines: [
            {
              id: `ca000000-0000-4000-8000-${next()}`,
              concept: 'Descuento',
              quantity: 1,
              unitPrice: params.total,
              taxRate: 0,
            },
          ],
        },
        NOW,
        TODAY,
        params.decimals ?? 2,
      );
      await ports.creditNotes.save(note);
      return id;
    }

    const confirmNote = (id: CreditNoteId) => ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);
    const cancelNote = (id: CreditNoteId) => ports.creditNotePosting.cancel(tenant, id, NOW);

    async function creditPaymentDraft(allocations: PaymentDetails['allocations'], creditSourceId: string, customerId = CUSTOMER): Promise<PaymentId> {
      const id = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);
      const invoices = await ports.ledger.invoices(tenant, { ids: allocations.map((row) => row.invoiceId) });

      await ports.payments.save(
        CustomerPayment.draft(
          id,
          tenant,
          `COB${next().slice(-6)}`,
          { customerId, date: ReceivablesDate.of(TODAY), method: 'credit_note', reference: null, notes: 'contrato cn', allocations, creditSourceId },
          invoices,
          aPaymentRates(),
          NOW,
          TODAY,
        ),
      );

      return id;
    }

    describe('PaymentRepository', () => {
      it('saves a draft with what it applies, and rewrites it when edited', async () => {
        const id = await draft([allocation(INVOICE, 40.1), allocation(OTHER_INVOICE, 0.2)]);
        const stored = (await ports.payments.find(tenant, id))!;

        expect(stored.toPrimitives()).toMatchObject({ status: 'draft', amount: 40.3, paymentDate: TODAY, method: 'transfer', notes: 'contrato' });

        const kept = stored.toPrimitives().allocations[0];
        stored.update({ customerId: CUSTOMER, date: ReceivablesDate.of('2026-01-10'), method: 'cash', allocations: [{ id: kept.id, invoiceId: kept.invoiceId, amount: 12 }] }, await ports.ledger.invoices(tenant, { ids: [kept.invoiceId] }), aPaymentRates(), NOW, TODAY);
        await ports.payments.save(stored);

        expect((await ports.payments.find(tenant, id))?.toPrimitives()).toMatchObject({ method: 'cash', amount: 12, paymentDate: '2026-01-10', reference: null, allocations: [{ ...kept, amount: 12 }] });
        expect(await ports.payments.find(TenantId.of(TENANT_B), id)).toBeNull();
        expect(await ports.payments.searchByTenant(TenantId.of(TENANT_B))).toEqual([]);
      });

      it('refuses to overwrite a payment confirmed in the meantime', async () => {
        const id = await draft([allocation(INVOICE, 10)]);
        const stale = (await ports.payments.find(tenant, id))!;
        await confirm(id);

        await expect(ports.payments.save(stale)).rejects.toThrow(PaymentNotEditableError);
      });

      // Dos personas con el mismo borrador: la segunda que guarda no borra lo que guardo la primera.
      it('refuses to overwrite a draft that someone else saved in the meantime', async () => {
        const id = await draft([allocation(INVOICE, 10)]);
        const first = (await ports.payments.find(tenant, id))!;
        const second = (await ports.payments.find(tenant, id))!;
        const kept = first.toPrimitives().allocations[0];
        const edited = async (payment: CustomerPayment, method: 'cash' | 'card', at: number) => {
          payment.update({ customerId: CUSTOMER, date: ReceivablesDate.of(TODAY), method, allocations: [kept] }, [await invoice()], aPaymentRates(), new Date(NOW.getTime() + at), TODAY);
        };

        await edited(first, 'cash', 1000);
        await ports.payments.save(first);
        await edited(second, 'card', 2000);

        await expect(ports.payments.save(second)).rejects.toThrow(ConcurrentModificationError);
        expect((await ports.payments.find(tenant, id))?.toPrimitives().method).toBe('cash');
      });

      // Buscar y paginar es donde el doble y PostgreSQL se separan si nadie mira: mayusculas,
      // campos nulos y el orden entre paginas.
      it('pages the payments and filters them by text, customer, status and date', async () => {
        const criteria = { text: null, customerId: null, status: null, from: null, to: null, limit: 10, offset: 0 };
        const first = await draft([allocation(INVOICE, 10)]);
        const second = await draft([allocation(OTHER_INVOICE, 5)], OTHER_CUSTOMER);
        await confirm(second);
        const code = (await ports.payments.find(tenant, first))!.toPrimitives().code;

        expect((await ports.payments.searchPage(tenant, criteria)).total).toBe(2);
        expect((await ports.payments.searchPage(tenant, { ...criteria, text: code.toLowerCase() })).payments.map((p) => p.id.value)).toEqual([first.value]);
        expect((await ports.payments.searchPage(tenant, { ...criteria, text: 'trf' })).total).toBe(2);
        expect((await ports.payments.searchPage(tenant, { ...criteria, customerId: OTHER_CUSTOMER })).payments.map((p) => p.id.value)).toEqual([second.value]);
        expect((await ports.payments.searchPage(tenant, { ...criteria, status: 'confirmed' })).payments.map((p) => p.id.value)).toEqual([second.value]);
        expect((await ports.payments.searchPage(tenant, { ...criteria, status: 'draft' })).total).toBe(1);
        expect((await ports.payments.searchPage(tenant, { ...criteria, from: TODAY })).total).toBe(2);
        expect((await ports.payments.searchPage(tenant, { ...criteria, to: '2026-01-14' })).total).toBe(0);

        // Dos paginas de una fila no pueden devolver la misma: el orden tiene que desempatar.
        const page1 = await ports.payments.searchPage(tenant, { ...criteria, limit: 1, offset: 0 });
        const page2 = await ports.payments.searchPage(tenant, { ...criteria, limit: 1, offset: 1 });

        expect(page1.total).toBe(2);
        expect(page1.payments.map((p) => p.id.value)).not.toEqual(page2.payments.map((p) => p.id.value));
        expect((await ports.payments.searchPage(TenantId.of(TENANT_B), criteria)).total).toBe(0);
      });
    });

    describe('PaymentPosting', () => {
      it('counts a payment only while it is confirmed', async () => {
        const id = await draft([allocation(INVOICE, 40)]);
        expect((await invoice()).balance()).toBe(100);

        await confirm(id);
        expect((await invoice()).toPrimitives()).toMatchObject({ paid: 40 });
        expect((await ports.payments.find(tenant, id))?.toPrimitives()).toMatchObject({ status: 'confirmed', confirmedAt: NOW });

        await cancel(id);
        expect((await invoice()).balance()).toBe(100);
      });

      // 40 USD cobrados en bolivares con el dolar a 38: la factura se emitio a 36,50.
      it('keeps what a payment in another currency is worth and the exchange difference of each invoice', async () => {
        const id = await draft([allocation(INVOICE, 40)]);
        const bolivars = { currency: 'VES', exchangeRate: 1, baseCurrency: 'USD', baseExchangeRate: 38 };

        await ports.posting.post(tenant, id, (payment, invoices) => payment.confirm(invoices, aPaymentRates(bolivars, { USD: 38 }), NOW, TODAY));

        expect((await ports.payments.find(tenant, id))?.toPrimitives()).toMatchObject({
          ...bolivars,
          amount: 1520,
          amountVes: 1520,
          allocations: [{ invoiceId: INVOICE, amount: 40, exchangeRate: 38, exchangeDifference: 60 }],
        });
        expect((await invoice()).toPrimitives().paid).toBe(40);
      });

      it('shows each invoice without the payment being posted, and writes nothing when the work fails', async () => {
        const id = await draft([allocation(INVOICE, 100)]);
        await confirm(id);

        await expect(
          ports.posting.post(tenant, id, (payment, invoices) => {
            expect(invoices.map((row) => row.balance())).toEqual([100]);
            payment.cancel(NOW);
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');

        expect((await ports.payments.find(tenant, id))?.currentStatus()).toBe('confirmed');
      });

      // La guarda del saldo bajo concurrencia real: dos cobros de 70 sobre una factura de 100.
      it('lets only one of two concurrent payments through when both do not fit the invoice', async () => {
        const [first, second] = [await draft([allocation(INVOICE, 70)]), await draft([allocation(INVOICE, 70)])];

        const results = await Promise.allSettled([confirm(first), confirm(second)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(PaymentExceedsBalanceError);
        expect((await invoice()).toPrimitives().paid).toBe(70);
      });

      it('refuses an invoice cancelled after the draft, and a payment of another company', async () => {
        const id = await draft([allocation(INVOICE, 10)]);
        await harness.cancelInvoice(TENANT_A, INVOICE);

        await expect(confirm(id)).rejects.toThrow(InvoiceNotPayableError);
        await expect(ports.posting.post(TenantId.of(TENANT_B), id, (payment) => payment.cancel(NOW))).rejects.toThrow(PaymentNotFoundError);
      });
    });

    describe('ReceivablesLedger', () => {
      it('reads the customers of one company with their credit limit', async () => {
        expect(await ports.ledger.customers(tenant)).toEqual([
          { id: CUSTOMER, code: 'CLI900001', name: 'Contrato Delta', paymentTermDays: 15, creditLimit: 500.5, isActive: true },
          { id: OTHER_CUSTOMER, code: 'CLI900002', name: 'Contrato Omega', paymentTermDays: 0, creditLimit: null, isActive: false },
        ]);
        expect(await ports.ledger.customer(tenant, FOREIGN_CUSTOMER)).toBeNull();
      });

      it('filters customers by code or name and never crosses companies', async () => {
        expect((await ports.ledger.customers(tenant, { text: 'contrato omega' })).map((row) => row.id)).toEqual([OTHER_CUSTOMER]);
        expect((await ports.ledger.customers(tenant, { text: 'CLI900001' })).map((row) => row.id)).toEqual([CUSTOMER]);
        expect((await ports.ledger.customers(tenant, { text: 'CONTRATO' })).map((row) => row.id)).toEqual([CUSTOMER, OTHER_CUSTOMER]);
        expect((await ports.ledger.customers(TenantId.of(TENANT_B), { text: 'contrato' })).map((row) => row.id)).toEqual([FOREIGN_CUSTOMER]);
      });

      it('filters invoices by customer or id and never crosses companies', async () => {
        expect((await ports.ledger.invoices(tenant)).map((row) => row.toPrimitives().code)).toEqual(['FAC900002', 'FAC900001']);
        expect((await ports.ledger.invoices(tenant, { customerId: OTHER_CUSTOMER })).map((row) => row.id)).toEqual([OTHER_INVOICE]);
        expect(await ports.ledger.invoices(tenant, { ids: [FOREIGN_INVOICE] })).toEqual([]);
        expect((await invoice()).toPrimitives()).toEqual({ id: INVOICE, code: 'FAC900002', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 100, ...DOLLARS, paid: 0 });
      });

      // El texto busca por codigo de factura y por nombre de cliente; las fechas, por vencimiento.
      it('filters invoices by text, due date and whether they are still issued', async () => {
        expect((await ports.ledger.invoices(tenant, { text: 'fac900002' })).map((row) => row.id)).toEqual([INVOICE]);
        expect((await ports.ledger.invoices(tenant, { text: 'CONTRATO OMEGA' })).map((row) => row.id)).toEqual([OTHER_INVOICE]);
        expect((await ports.ledger.invoices(tenant, { text: 'contrato' })).map((row) => row.id)).toEqual([INVOICE, OTHER_INVOICE]);
        expect((await ports.ledger.invoices(tenant, { from: '2026-01-20' })).map((row) => row.id)).toEqual([INVOICE]);
        expect((await ports.ledger.invoices(tenant, { to: '2026-01-02' })).map((row) => row.id)).toEqual([OTHER_INVOICE]);
        expect((await ports.ledger.invoices(tenant, { from: '2026-01-03', to: '2026-01-19' }))).toEqual([]);

        await harness.cancelInvoice(TENANT_A, INVOICE);

        expect((await ports.ledger.invoices(tenant, { onlyIssued: true })).map((row) => row.id)).toEqual([OTHER_INVOICE]);
        expect((await ports.ledger.invoices(tenant, { onlyIssued: true, text: 'fac900002' }))).toEqual([]);
      });
    });

    describe('CustomerCreditNoteRepository', () => {
      it('saves a draft with its lines, and rewrites it when edited', async () => {
        const id = await draftNote({ total: 50 });
        const stored = (await ports.creditNotes.find(tenant, id))!;

        expect(stored.toPrimitives()).toMatchObject({ status: 'draft', total: 50, issueDate: TODAY, reason: 'subsequent_discount' });
        expect(stored.toPrimitives().lines).toHaveLength(1);

        stored.update(
          {
            customerId: CUSTOMER,
            invoiceId: null,
            salesReturnId: null,
            issueDate: ReceivablesDate.of('2026-01-12'),
            reason: 'other',
            reasonDetail: 'Detalle de prueba',
            notes: 'editada',
            currency: DocumentCurrency.fromPrimitives({
              currency: 'USD',
              exchangeRate: 1,
              baseCurrency: 'USD',
              baseExchangeRate: 1,
              manualExchangeRate: false,
            }),
            lines: [
              {
                id: stored.toPrimitives().lines[0].id,
                concept: 'Concepto corregido',
                quantity: 2,
                unitPrice: 30,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(stored);

        const updated = (await ports.creditNotes.find(tenant, id))!;
        expect(updated.toPrimitives()).toMatchObject({ total: 60, issueDate: '2026-01-12', reason: 'other', reasonDetail: 'Detalle de prueba' });
        expect(await ports.creditNotes.find(TenantId.of(TENANT_B), id)).toBeNull();
      });

      it('refuses to overwrite a credit note confirmed in the meantime', async () => {
        const id = await draftNote({ total: 50 });
        const stale = (await ports.creditNotes.find(tenant, id))!;
        await confirmNote(id);

        await expect(ports.creditNotes.save(stale)).rejects.toThrow(CreditNoteNotEditableError);
      });

      it('pages the credit notes and filters them by text, customer, invoice and status', async () => {
        const first = await draftNote({ total: 50 });
        const second = await draftNote({ customerId: OTHER_CUSTOMER, invoiceId: OTHER_INVOICE, total: 20 });
        await confirmNote(second);
        const code = (await ports.creditNotes.find(tenant, first))!.toPrimitives().code;

        const all = await ports.creditNotes.searchPage(tenant, {});
        expect(all.total).toBe(2);

        const byCode = await ports.creditNotes.searchPage(tenant, { text: code.toLowerCase() });
        expect(byCode.notes.map((n) => n.id.value)).toEqual([first.value]);

        const byCustomer = await ports.creditNotes.searchPage(tenant, { customerId: OTHER_CUSTOMER });
        expect(byCustomer.notes.map((n) => n.id.value)).toEqual([second.value]);

        const byInvoice = await ports.creditNotes.searchPage(tenant, { invoiceId: OTHER_INVOICE });
        expect(byInvoice.notes.map((n) => n.id.value)).toEqual([second.value]);

        const byStatus = await ports.creditNotes.searchPage(tenant, { status: 'confirmed' });
        expect(byStatus.notes.map((n) => n.id.value)).toEqual([second.value]);
      });

      it('queries applied payment sums across multiple credit notes in batch, respecting payment exclusions', async () => {
        const note1Id = await draftNote({ total: 100 });
        const note2Id = await draftNote({ total: 50 });
        await confirmNote(note1Id);
        await confirmNote(note2Id);

        const INV_1 = 'fa000000-0000-4000-8000-000000000021';
        const INV_2 = 'fa000000-0000-4000-8000-000000000022';
        await harness.invoice(TENANT_A, { id: INV_1, code: 'FAC900021', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 60, ...DOLLARS });
        await harness.invoice(TENANT_A, { id: INV_2, code: 'FAC900022', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 30, ...DOLLARS });

        const p1 = await creditPaymentDraft([allocation(INV_1, 40)], note1Id.value);
        await confirm(p1);

        const p2 = await creditPaymentDraft([allocation(INV_2, 25)], note2Id.value);
        await confirm(p2);

        const map = await ports.creditNotes.appliedAmountsByNotes(tenant, [note1Id, note2Id]);
        expect(map.get(note1Id.value)).toBe(40);
        expect(map.get(note2Id.value)).toBe(25);

        const mapWithExclusion = await ports.creditNotes.appliedAmountsByNotes(tenant, [note1Id, note2Id], p1.value);
        expect(mapWithExclusion.get(note1Id.value)).toBe(0);
        expect(mapWithExclusion.get(note2Id.value)).toBe(25);

        const fetched = await ports.creditNotes.findByIds(tenant, [note1Id, note2Id]);
        expect(fetched.map((n) => n.id.value).sort()).toEqual([note1Id.value, note2Id.value].sort());
      });
    });

    describe('CreditNotePosting', () => {
      it('caps issue payment allocation at invoice remaining balance and keeps remainder as available credit', async () => {
        // Factura de 100 cobrada 60 -> saldo vivo 40
        const paymentId = await draft([allocation(INVOICE, 60)]);
        await confirm(paymentId);
        expect((await invoice()).balance()).toBe(40);

        // Nota de 100 sobre la factura de 100
        const noteId = await draftNote({ invoiceId: INVOICE, total: 100 });
        await confirmNote(noteId);

        // La factura queda totalmente saldada
        expect((await invoice()).balance()).toBe(0);
        expect((await invoice()).toPrimitives().paid).toBe(100);

        const note = (await ports.creditNotes.find(tenant, noteId))!;
        expect(note.currentStatus()).toBe('confirmed');
        expect(note.toPrimitives().issuePaymentId).not.toBeNull();

        // El cobro de emision se creo automaticamente por 40 (el saldo vivo)
        const issuePayment = (await ports.payments.find(tenant, PaymentId.of(note.toPrimitives().issuePaymentId!)))!;
        expect(issuePayment.toPrimitives()).toMatchObject({
          amount: 40,
          method: 'credit_note',
          creditSourceId: noteId.value,
          status: 'confirmed',
        });

        // Credito disponible en la nota: 100 - 40 = 60
        const applied = await ports.creditNotes.appliedPaymentsSum(tenant, noteId);
        expect(applied).toBe(40);
        expect(NoteCredit.available(note, applied)).toBe(60);

        const available = await ports.creditNotes.findAvailableCreditsByCustomer(tenant, CUSTOMER);
        expect(available.map((n) => n.id.value)).toContain(noteId.value);
      });

      it('refuses to confirm a credit note that exceeds invoice amount quota', async () => {
        const noteId = await draftNote({ invoiceId: INVOICE, total: 150 });
        await expect(confirmNote(noteId)).rejects.toThrow(CreditQuotaExceededError);
      });

      it('spends available credit from Collections on another invoice of the customer', async () => {
        // Factura de 100 cobrada 60 -> saldo 40. Nota de 100 -> abona 40, sobran 60 de credito.
        const paymentId = await draft([allocation(INVOICE, 60)]);
        await confirm(paymentId);
        const noteId = await draftNote({ invoiceId: INVOICE, total: 100 });
        await confirmNote(noteId);

        // Creamos una segunda factura para el mismo cliente de 60
        const SECOND_INVOICE = 'fa000000-0000-4000-8000-000000000002';
        await harness.invoice(TENANT_A, { id: SECOND_INVOICE, code: 'FAC900003', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 60, ...DOLLARS });

        // Cobro con credit_note que gasta los 60 de credito en la segunda factura
        const creditPayId = await creditPaymentDraft([allocation(SECOND_INVOICE, 60)], noteId.value);
        await confirm(creditPayId);

        const secondInv = (await ports.ledger.invoices(tenant, { ids: [SECOND_INVOICE] }))[0];
        expect(secondInv.balance()).toBe(0);

        const applied = await ports.creditNotes.appliedPaymentsSum(tenant, noteId);
        expect(applied).toBe(100);
        const note = (await ports.creditNotes.find(tenant, noteId))!;
        expect(NoteCredit.available(note, applied)).toBe(0);

        const available = await ports.creditNotes.findAvailableCreditsByCustomer(tenant, CUSTOMER);
        expect(available.map((n) => n.id.value)).not.toContain(noteId.value);
      });

      it('lets only one of two concurrent credit note payments through when available credit is not enough for both', async () => {
        // Factura de 100 cobrada 60. Nota de 100 -> abona 40, sobran 60 de credito.
        const p0 = await draft([allocation(INVOICE, 60)]);
        await confirm(p0);
        const noteId = await draftNote({ invoiceId: INVOICE, total: 100 });
        await confirmNote(noteId);

        // Dos facturas para el cliente, cada una de 50
        const INV_A = 'fa000000-0000-4000-8000-000000000010';
        const INV_B = 'fa000000-0000-4000-8000-000000000011';
        await harness.invoice(TENANT_A, { id: INV_A, code: 'FAC900010', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 50, ...DOLLARS });
        await harness.invoice(TENANT_A, { id: INV_B, code: 'FAC900011', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 50, ...DOLLARS });

        // Dos cobros simultaneos de 40 cada uno sobre la nota que solo tiene 60 de credito disponible
        const [first, second] = [
          await creditPaymentDraft([allocation(INV_A, 40)], noteId.value),
          await creditPaymentDraft([allocation(INV_B, 40)], noteId.value),
        ];

        const results = await Promise.allSettled([confirm(first), confirm(second)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(CreditNoteExceededError);

        const applied = await ports.creditNotes.appliedPaymentsSum(tenant, noteId);
        expect(applied).toBe(80); // 40 de emision + 40 del cobro ganador
      });

      it('cancelling a payment that spent credit restores it; cancelling a note with external payments is refused', async () => {
        // Factura de 100 cobrada 60. Nota de 100 -> abona 40, sobran 60.
        const p0 = await draft([allocation(INVOICE, 60)]);
        await confirm(p0);
        const noteId = await draftNote({ invoiceId: INVOICE, total: 100 });
        await confirmNote(noteId);

        const INV_C = 'fa000000-0000-4000-8000-000000000020';
        await harness.invoice(TENANT_A, { id: INV_C, code: 'FAC900020', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 50, ...DOLLARS });

        const extPayment = await creditPaymentDraft([allocation(INV_C, 30)], noteId.value);
        await confirm(extPayment);

        // Si intentamos anular la nota con el cobro externo activo: se rechaza
        await expect(cancelNote(noteId)).rejects.toThrow(CreditNoteWithApplicationsError);

        // Al anular el cobro externo: el credito se restaura en la nota
        await cancel(extPayment);
        const note = (await ports.creditNotes.find(tenant, noteId))!;
        const applied = await ports.creditNotes.appliedPaymentsSum(tenant, noteId);
        expect(NoteCredit.available(note, applied)).toBe(60);

        // Y ahora si se puede anular la nota de credito: revierte su cobro de emision
        await cancelNote(noteId);
        expect((await invoice()).balance()).toBe(40); // Restaurado el saldo de la factura a 40
        expect(note.currentStatus()).toBe('confirmed'); // La instancia vieja
        expect((await ports.creditNotes.find(tenant, noteId))?.currentStatus()).toBe('cancelled');
      });

      it('closes the backdoor: issue payment cannot be cancelled directly from Collections', async () => {
        const noteId = await draftNote({ invoiceId: INVOICE, total: 50 });
        await confirmNote(noteId);

        const note = (await ports.creditNotes.find(tenant, noteId))!;
        const issuePaymentId = PaymentId.of(note.toPrimitives().issuePaymentId!);

        await expect(cancel(issuePaymentId)).rejects.toThrow(IssuePaymentCannotBeCancelledDirectlyError);
      });

      it('concurrently cancelling a credit note and cancelling its issue payment directly never deadlocks', async () => {
        const noteId = await draftNote({ invoiceId: INVOICE, total: 50 });
        await confirmNote(noteId);

        const note = (await ports.creditNotes.find(tenant, noteId))!;
        const issuePaymentId = PaymentId.of(note.toPrimitives().issuePaymentId!);

        const results = await Promise.allSettled([
          cancelNote(noteId),
          cancel(issuePaymentId),
        ]);

        for (const result of results) {
          if (result.status === 'rejected') {
            const err = result.reason;
            expect(
              err instanceof IssuePaymentCannotBeCancelledDirectlyError ||
              err instanceof CreditNoteAlreadyCancelledError ||
              err instanceof PaymentAlreadyCancelledError,
            ).toBe(true);
          }
        }
      });

      it('concurrently cancelling a credit note and posting on its issue payment respects deterministic lock order without database deadlock', async () => {
        const noteId = await draftNote({ invoiceId: INVOICE, total: 50 });
        await confirmNote(noteId);

        const note = (await ports.creditNotes.find(tenant, noteId))!;
        const issuePaymentId = PaymentId.of(note.toPrimitives().issuePaymentId!);

        const results = await Promise.allSettled([
          cancelNote(noteId),
          ports.posting.post(tenant, issuePaymentId, (payment) => {
            if (payment.currentStatus() === 'confirmed') {
              payment.cancel(NOW);
            }
          }),
        ]);

        for (const result of results) {
          if (result.status === 'rejected') {
            const err = result.reason;
            expect(
              err instanceof CreditNoteAlreadyCancelledError ||
              err instanceof CreditNoteNotConfirmedError ||
              err instanceof PaymentAlreadyCancelledError,
            ).toBe(true);
          }
        }
      });

      it('validates that sales return must belong to the same order when credit note cites both invoice and return', async () => {
        const RETURN_DIFF = 'd7000000-0000-4000-8000-000000000001';
        await harness.salesReturn(TENANT_A, RETURN_DIFF, CUSTOMER);

        const noteId = await draftNote({ invoiceId: INVOICE, salesReturnId: RETURN_DIFF, total: 50 });
        await expect(confirmNote(noteId)).rejects.toThrow(CreditNoteReturnOrderMismatchError);
      });

      it('lets only one of two concurrent credit notes credit the same sales return', async () => {
        const RETURN_ID = 'd7000000-0000-4000-8000-000000000002';
        await harness.salesReturn(TENANT_A, RETURN_ID, CUSTOMER);

        const note1Id = await draftNote({ salesReturnId: RETURN_ID, total: 30 });
        const note2Id = await draftNote({ salesReturnId: RETURN_ID, total: 30 });

        const results = await Promise.allSettled([confirmNote(note1Id), confirmNote(note2Id)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason).toBeInstanceOf(CreditNoteReturnAlreadyCreditedError);
      });

      it('concurrently confirming a credit note and cancelling its sales return allows only one to succeed', async () => {
        const RETURN_ID = 'd7000000-0000-4000-8000-000000000003';
        await harness.salesReturn(TENANT_A, RETURN_ID, CUSTOMER);

        const noteId = await draftNote({ salesReturnId: RETURN_ID, total: 50 });

        const results = await Promise.allSettled([confirmNote(noteId), harness.cancelSalesReturn(TENANT_A, RETURN_ID)]);

        expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason instanceof CreditNoteReturnNotConfirmedError || rejected.reason instanceof SalesReturnWithCreditNoteError).toBe(true);
      });

      it('refuses to confirm a credit note citing an invoice that was cancelled after the draft', async () => {
        const noteId = await draftNote({ invoiceId: INVOICE, total: 50 });
        await harness.cancelInvoice(TENANT_A, INVOICE);
        await expect(confirmNote(noteId)).rejects.toThrow(InvoiceNotPayableError);
      });

      it('confirms a credit note and creates its issue payment respecting the company amount decimals', async () => {
        await harness.setAmountDecimals(TENANT_A, 3);

        const INV_3DEC = 'fa000000-0000-4000-8000-000000000030';
        await harness.invoice(TENANT_A, { id: INV_3DEC, code: 'FAC900030', customerId: CUSTOMER, issueDate: '2026-01-06', dueDate: '2026-01-20', status: 'issued', total: 100, ...DOLLARS });

        const noteId = await draftNote({ invoiceId: INV_3DEC, total: 40.125, decimals: 3 });
        await confirmNote(noteId);

        const note = (await ports.creditNotes.find(tenant, noteId))!;
        expect(note.currentStatus()).toBe('confirmed');

        const issuePayment = (await ports.payments.find(tenant, PaymentId.of(note.toPrimitives().issuePaymentId!)))!;
        expect(issuePayment.toPrimitives().amount).toBe(40.125);
      });
    });

    describe('ReceivablesCodeSequence', () => {
      it('counts per tenant', async () => {
        expect(await ports.codes.next(tenant, 'COB')).toBe(1);
        expect(await ports.codes.next(tenant, 'COB')).toBe(2);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'COB')).toBe(1);
        expect(await ports.codes.next(tenant, 'NCC')).toBe(1);
        expect(await ports.codes.next(tenant, 'NCC')).toBe(2);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'NCC')).toBe(1);
      });
    });
  });
}
