import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CreditNoteExceededError,
  CreditNoteLineAmountExceedsInvoiceError,
  CreditNoteLineItemMismatchError,
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PaymentAlreadyCancelledError,
  PaymentExceedsBalanceError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  RevaluationSourceMovementNotFoundError,
} from '../domain/errors/payables.errors.js';
import { SupplierPayment, PaymentDetails, PaymentId } from '../domain/payment/supplier-payment.entity.js';
import { SupplierCreditNote, SupplierCreditNoteId } from '../domain/credit-note/supplier-credit-note.entity.js';
import { PayablesDate } from '../domain/shared/payables-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import {
  DOLLARS,
  INVOICE,
  NOW,
  OTHER_INVOICE,
  OTHER_SUPPLIER,
  SUPPLIER,
  TENANT_A,
  TENANT_B,
  TODAY,
  aPaymentRates,
} from '../domain/testing/payables.mother.js';
import { DocumentCurrency } from '../../../shared/domain/document-currency.js';
import { PayablesPorts, PayablesPortsHarness } from './payables-ports.harness.js';

const tenant = TenantId.of(TENANT_A);
const FOREIGN_SUPPLIER = 'e8999999-9999-4999-8999-999999999999';
const FOREIGN_INVOICE = 'f9999999-9999-4999-8999-999999999999';

const USD_VES_RATES = DocumentCurrency.of({
  currency: 'USD',
  exchangeRate: 36.5,
  baseCurrency: 'VES',
  baseExchangeRate: 1,
  manualRate: false,
});

const USD_RATE_40 = DocumentCurrency.of({
  currency: 'USD',
  exchangeRate: 40.0,
  baseCurrency: 'VES',
  baseExchangeRate: 1,
  manualRate: false,
});

// UNA suite para el doble y para PostgreSQL. Lo que importa: que dos pagos simultaneos no paguen
// una factura de mas, que lo pagado cuente solo lo confirmado y que nada cruce de empresa.
export function describePayablesPortsContract(implementation: string, createHarness: () => PayablesPortsHarness): void {
  describe(`Payables ports contract: ${implementation}`, () => {
    const harness = createHarness();
    let ports: PayablesPorts;
    let counter = 0;

    beforeEach(async () => {
      await harness.reset();
      ports = harness.ports();
      await harness.supplier(TENANT_A, { id: SUPPLIER, code: 'PRV900001', name: 'Distribuidor Delta', paymentTermDays: 15, isActive: true });
      await harness.supplier(TENANT_A, { id: OTHER_SUPPLIER, code: 'PRV900002', name: 'Suministros Omega', paymentTermDays: 0, isActive: false });
      await harness.supplier(TENANT_B, { id: FOREIGN_SUPPLIER, code: 'PRV900001', name: 'Proveedor ajeno', paymentTermDays: 0, isActive: true });
      await harness.invoice(TENANT_A, { id: INVOICE, code: 'FCP900002', supplierId: SUPPLIER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'confirmed', total: 100, ...DOLLARS });
      await harness.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FCP900001', supplierId: OTHER_SUPPLIER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'confirmed', total: 30.3, ...DOLLARS });
      await harness.invoice(TENANT_B, { id: FOREIGN_INVOICE, code: 'FCP900001', supplierId: FOREIGN_SUPPLIER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'confirmed', total: 10, ...DOLLARS });
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    const next = () => String((counter += 1)).padStart(12, '0');
    const allocation = (invoiceId: string, amount: number): PaymentDetails['allocations'][number] => ({ id: `da000000-0000-4000-8000-${next()}`, invoiceId, amount });

    async function draft(allocations: PaymentDetails['allocations'], supplierId = SUPPLIER): Promise<PaymentId> {
      const id = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);
      const invoices = await ports.ledger.invoices(tenant, { ids: allocations.map((row) => row.invoiceId) });

      await ports.payments.save(
        SupplierPayment.draft(id, tenant, `PAG${next().slice(-6)}`, { supplierId, date: PayablesDate.of(TODAY), method: 'transfer', reference: 'TRF', notes: 'contrato', allocations }, invoices, aPaymentRates(), NOW, TODAY),
      );

      return id;
    }

    async function draftCreditPayment(allocations: PaymentDetails['allocations'], creditSourceId: string, supplierId = SUPPLIER): Promise<PaymentId> {
      const id = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);
      const invoices = await ports.ledger.invoices(tenant, { ids: allocations.map((row) => row.invoiceId) });

      await ports.payments.save(
        SupplierPayment.draft(id, tenant, `PAG${next().slice(-6)}`, { supplierId, date: PayablesDate.of(TODAY), method: 'credit_note', creditSourceId, reference: null, notes: 'pago con credito', allocations }, invoices, aPaymentRates(), NOW, TODAY),
      );

      return id;
    }

    const confirm = (id: PaymentId) => ports.posting.post(tenant, id, (payment, invoices) => payment.confirm(invoices, aPaymentRates(), NOW, TODAY));
    const cancel = (id: PaymentId) => ports.posting.post(tenant, id, (payment) => payment.cancel(NOW));
    const invoice = async (id = INVOICE) => (await ports.ledger.invoices(tenant, { ids: [id] }))[0];

    it('creates a draft payment without affecting invoice balance', async () => {
      const id = await draft([allocation(INVOICE, 40)]);
      const inv = await invoice();
      expect(inv.balance()).toBe(100);

      const payment = await ports.payments.find(tenant, id);
      expect(payment?.currentStatus()).toBe('draft');
      expect(payment?.toPrimitives().amount).toBe(40);
    });

    it('confirms a payment and reduces the invoice balance', async () => {
      const id = await draft([allocation(INVOICE, 40)]);
      await confirm(id);

      const inv = await invoice();
      expect(inv.balance()).toBe(60);
      expect(inv.paymentStatus()).toBe('partially_paid');

      const payment = await ports.payments.find(tenant, id);
      expect(payment?.currentStatus()).toBe('confirmed');
    });

    it('cancels a confirmed payment and restores invoice balance', async () => {
      const id = await draft([allocation(INVOICE, 40)]);
      await confirm(id);

      expect((await invoice()).balance()).toBe(60);

      await cancel(id);

      expect((await invoice()).balance()).toBe(100);
      const payment = await ports.payments.find(tenant, id);
      expect(payment?.currentStatus()).toBe('cancelled');
    });

    it('rejects confirmation if payment exceeds invoice balance', async () => {
      const id = await draft([allocation(INVOICE, 60)]);
      await confirm(id);

      const second = await draft([allocation(INVOICE, 50)]);
      await expect(confirm(second)).rejects.toThrow(PaymentExceedsBalanceError);
    });

    it('serializes concurrent payments so they cannot overpay the invoice', async () => {
      // Factura debe 100. Dos pagos simultaneos de 60: uno debe pasar y el otro fallar
      const first = await draft([allocation(INVOICE, 60)]);
      const second = await draft([allocation(INVOICE, 60)]);

      const results = await Promise.allSettled([confirm(first), confirm(second)]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PaymentExceedsBalanceError);

      const inv = await invoice();
      expect(inv.balance()).toBe(40);
    });

    it('rejects payment on an invoice of another supplier', async () => {
      const id = await draft([allocation(OTHER_INVOICE, 20)], SUPPLIER);
      await expect(confirm(id)).rejects.toThrow(InvoiceOfAnotherSupplierError);
    });

    it('rejects payment on a cancelled invoice', async () => {
      await harness.cancelInvoice(TENANT_A, INVOICE);
      const id = await draft([allocation(INVOICE, 20)]);
      await expect(confirm(id)).rejects.toThrow(InvoiceNotPayableError);
    });

    it('isolates payments and invoices by tenant', async () => {
      const foreignId = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);
      const foreignTenant = TenantId.of(TENANT_B);
      const foreignInvoices = await ports.ledger.invoices(foreignTenant, { ids: [FOREIGN_INVOICE] });

      await ports.payments.save(
        SupplierPayment.draft(foreignId, foreignTenant, 'PAG999999', { supplierId: FOREIGN_SUPPLIER, date: PayablesDate.of(TODAY), method: 'cash', allocations: [allocation(FOREIGN_INVOICE, 10)] }, foreignInvoices, aPaymentRates(), NOW, TODAY),
      );

      // No se encuentra desde TENANT_A
      expect(await ports.payments.find(tenant, foreignId)).toBeNull();

      // Las facturas de TENANT_A no incluyen la de TENANT_B
      const invoicesA = await ports.ledger.invoices(tenant);
      expect(invoicesA.some((inv) => inv.id === FOREIGN_INVOICE)).toBe(false);
    });

    describe('SupplierCreditNote contract', () => {
      it('saves and finds a draft credit note with its lines and isolates by tenant', async () => {
        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            issueDate: PayablesDate.of(TODAY),
            reason: 'subsequent_discount',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, concept: 'Descuento', quantity: 1, unitPrice: 20, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );

        await ports.creditNotes.save(note);

        const found = await ports.creditNotes.find(tenant, id);
        expect(found).not.toBeNull();
        expect(found?.toPrimitives().total).toBe(20);
        expect(found?.currentStatus()).toBe('draft');

        // Aislamiento: no se encuentra desde TENANT_B
        expect(await ports.creditNotes.find(TenantId.of(TENANT_B), id)).toBeNull();
      });

      it('confirms a credit note linked to an invoice and generates an issue payment', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [{ id: invLineId, subtotal: 100 }]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, concept: 'Ajuste', quantity: 1, unitPrice: 35, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );

        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        const confirmed = await ports.creditNotes.find(tenant, id);
        expect(confirmed?.currentStatus()).toBe('confirmed');
        expect(confirmed?.issuePaymentId()).not.toBeNull();

        // La factura se amortizo
        const inv = await invoice(INVOICE);
        expect(inv.balance()).toBe(65);

        // Anular la nota de credito restaura el saldo
        await ports.creditNotePosting.cancel(tenant, id, NOW);
        const cancelled = await ports.creditNotes.find(tenant, id);
        expect(cancelled?.currentStatus()).toBe('cancelled');
        expect((await invoice(INVOICE)).balance()).toBe(100);
      });

      it('rejects credit note confirmation if item does not match invoice line', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemA = `a0000000-0000-4000-8000-${next()}`;
        const itemB = `b0000000-0000-4000-8000-${next()}`;

        await harness.invoiceLines(TENANT_A, INVOICE, [{ id: invLineId, itemId: itemA, subtotal: 100 }]);
        await harness.ensureItem(TENANT_A, itemB);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, itemId: itemB, quantity: 1, unitPrice: 30, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );

        await ports.creditNotes.save(note);
        await expect(ports.creditNotePosting.confirm(tenant, id, NOW, TODAY)).rejects.toThrow(
          CreditNoteLineItemMismatchError,
        );
      });

      it('rejects credit note confirmation if cumulative line amount exceeds invoice line total', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [{ id: invLineId, subtotal: 100 }]);

        const note1Id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note1 = SupplierCreditNote.draft(
          note1Id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, concept: 'Rebaja 1', quantity: 1, unitPrice: 60, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note1);
        await ports.creditNotePosting.confirm(tenant, note1Id, NOW, TODAY);

        const note2Id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note2 = SupplierCreditNote.draft(
          note2Id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, concept: 'Rebaja 2', quantity: 1, unitPrice: 50, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note2);

        await expect(ports.creditNotePosting.confirm(tenant, note2Id, NOW, TODAY)).rejects.toThrow(
          CreditNoteLineAmountExceedsInvoiceError,
        );
      });

      it('serializes concurrent credit notes so cumulative line amounts cannot exceed line total', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [{ id: invLineId, subtotal: 100 }]);

        const note1Id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note1 = SupplierCreditNote.draft(
          note1Id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, concept: 'Simultanea 1', quantity: 1, unitPrice: 60, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note1);

        const note2Id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note2 = SupplierCreditNote.draft(
          note2Id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: invLineId, concept: 'Simultanea 2', quantity: 1, unitPrice: 60, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note2);

        const results = await Promise.allSettled([
          ports.creditNotePosting.confirm(tenant, note1Id, NOW, TODAY),
          ports.creditNotePosting.confirm(tenant, note2Id, NOW, TODAY),
        ]);

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
          CreditNoteLineAmountExceedsInvoiceError,
        );

        const inv = await invoice(INVOICE);
        expect(inv.balance()).toBe(40);
      });

      it('creates draft negative revaluation adjustment when confirming credit note for goods price discount (H9 §3.10)', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5 },
        ]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                invoiceLineId: invLineId,
                itemId,
                concept: 'Rebaja mercancia',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        const confirmed = await ports.creditNotes.find(tenant, id);
        expect(confirmed?.currentStatus()).toBe('confirmed');
        expect(confirmed?.toPrimitives().priceDifference).toBeCloseTo(-20 * 36.5, 2);

        const adjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(adjs.length).toBe(1);
        expect(adjs[0].type).toBe('revaluation');
        expect(adjs[0].status).toBe('draft');
        expect(adjs[0].originType).toBe('supplier_credit_note');
        expect(adjs[0].originId).toBe(id.value);
        expect(adjs[0].lines[0].direction).toBe('out');
        expect(adjs[0].lines[0].amount).toBeCloseTo(-20 * 36.5, 2);
        expect(adjs[0].lines[0].sourceMovementId).toBeDefined();
      });

      it('rejects confirming price discount credit note if receipt line has no inventory movement', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5, withoutMovement: true },
        ]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                invoiceLineId: invLineId,
                itemId,
                concept: 'Rebaja mercancia sin kardex',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);

        await expect(ports.creditNotePosting.confirm(tenant, id, NOW, TODAY)).rejects.toThrow(
          RevaluationSourceMovementNotFoundError,
        );
      });

      it('computes distinct price difference and exchange difference when goods receipt and credit note have different exchange rates (H9 §3.3 y §3.10)', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        // Entrada a tasa 35.0
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 35.0 },
        ]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        // Nota de credito a tasa 40.0 con rebaja de 20 USD
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: USD_RATE_40,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                invoiceLineId: invLineId,
                itemId,
                concept: 'Rebaja con tasas distintas',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        const confirmed = await ports.creditNotes.find(tenant, id);
        expect(confirmed?.currentStatus()).toBe('confirmed');
        // A tasa de recepcion (35.0): -20 * 35.0 = -700.0
        expect(confirmed?.toPrimitives().priceDifference).toBeCloseTo(-700.0, 2);
        // Variacion de tipo de cambio (40.0 - 35.0 = 5.0): -20 * 5.0 = -100.0
        expect(confirmed?.toPrimitives().exchangeDifference).toBeCloseTo(-100.0, 2);

        const adjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(adjs.length).toBe(1);
        expect(adjs[0].type).toBe('revaluation');
        expect(adjs[0].status).toBe('draft');
        // El ajuste de revaluacion disminuye inventario a tasa de recepcion (-700.0)
        expect(adjs[0].lines[0].direction).toBe('out');
        expect(adjs[0].lines[0].amount).toBeCloseTo(-700.0, 2);
        expect(adjs[0].lines[0].sourceMovementId).toBeDefined();
      });

      it('does not create revaluation adjustments when confirming credit note that credits a purchase return (H9 §3.10)', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5 },
        ]);

        const invLines = await ports.ledger.invoiceLines(tenant, INVOICE);
        const receiptLineId = invLines[0]?.receiptLineId!;

        const returnId = `d1000000-0000-4000-8000-${next()}`;
        await harness.purchaseReturn(TENANT_A, returnId, SUPPLIER, 'confirmed', receiptLineId ? [receiptLineId] : undefined);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            purchaseReturnId: returnId,
            issueDate: PayablesDate.of(TODAY),
            reason: 'return',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                itemId,
                concept: 'Acredita devolucion',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        const confirmed = await ports.creditNotes.find(tenant, id);
        expect(confirmed?.currentStatus()).toBe('confirmed');
        expect(confirmed?.toPrimitives().priceDifference).toBe(0);
        expect(confirmed?.toPrimitives().exchangeDifference).toBe(0);

        const adjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(adjs).toHaveLength(0);
      });

      it('cancels draft revaluation adjustment when credit note is cancelled (H9 §4.1)', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5 },
        ]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                invoiceLineId: invLineId,
                itemId,
                concept: 'Rebaja mercancia',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        await ports.creditNotePosting.cancel(tenant, id, NOW);

        const adjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(adjs.length).toBe(1);
        expect(adjs[0].status).toBe('cancelled');
      });

      it('allows spending available credit from a credit note in a payment and rejects exceeding it (H9 §3.10)', async () => {
        // Nota libre por 70 USD
        const noteId = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          noteId,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: null,
            issueDate: PayablesDate.of(TODAY),
            reason: 'subsequent_discount',
            currency: aPaymentRates().currency,
            lines: [{ id: `e0000000-0000-4000-8000-${next()}`, invoiceLineId: null, concept: 'Credito comercial', quantity: 1, unitPrice: 70, taxRate: 0 }],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, noteId, NOW, TODAY);

        // Pagar 40 USD de INVOICE (que debe 100) usando el credito de la nota
        const pay1Id = await draftCreditPayment([allocation(INVOICE, 40)], noteId.value);
        await confirm(pay1Id);

        const inv = await invoice(INVOICE);
        expect(inv.balance()).toBe(60);

        // Intentar gastar 35 mas (40 + 35 = 75 > 70 disponible de la nota) se rechaza
        const pay2Id = await draftCreditPayment([allocation(INVOICE, 35)], noteId.value);
        await expect(confirm(pay2Id)).rejects.toThrow(CreditNoteExceededError);
      });

      it('creates reverse revaluation adjustment when cancelling credit note whose adjustment was confirmed (H9 §4.1)', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5 },
        ]);

        const id = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          id,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            issueDate: PayablesDate.of(TODAY),
            reason: 'price_correction',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                invoiceLineId: invLineId,
                itemId,
                concept: 'Rebaja mercancia',
                quantity: 1,
                unitPrice: 20,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, id, NOW, TODAY);

        const adjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(adjs.length).toBe(1);
        await harness.approveAdjustment(tenant.value, adjs[0].id);

        await ports.creditNotePosting.cancel(tenant, id, NOW);

        const updatedAdjs = await harness.adjustmentsOf(tenant.value, id.value);
        expect(updatedAdjs.length).toBe(2);
        const reverseAdj = updatedAdjs.find((a) => a.id !== adjs[0].id)!;
        expect(reverseAdj.status).toBe('draft');
        expect(reverseAdj.lines[0].direction).toBe('in');
        expect(reverseAdj.lines[0].amount).toBeCloseTo(20 * 36.5, 2);
      });
    });

    describe('eligible purchase returns and credited return tracking', () => {
      it('returns confirmed returns for the supplier and tracks credited returns', async () => {
        const invLineId = `f0000000-0000-4000-8000-${next()}`;
        const itemId = `f1000000-0000-4000-8000-${next()}`;
        await harness.invoiceLines(TENANT_A, INVOICE, [
          { id: invLineId, itemId, subtotal: 100, receiptRate: 36.5 },
        ]);

        const invLines = await ports.ledger.invoiceLines(tenant, INVOICE);
        const receiptLineId = invLines[0]?.receiptLineId!;

        const returnId = `d8000000-0000-4000-8000-${next()}`;
        await harness.purchaseReturn(TENANT_A, returnId, SUPPLIER, 'confirmed', receiptLineId ? [receiptLineId] : undefined);

        // 1. confirmedReturnsBySupplier lista la devolución confirmada
        const returns = await ports.ledger.confirmedReturnsBySupplier(tenant, SUPPLIER);
        expect(returns.some((r) => r.id === returnId)).toBe(true);

        // 2. Antes de acreditarla, confirmedCreditedReturnIds no la contiene
        const creditedBefore = await ports.creditNotes.confirmedCreditedReturnIds(tenant);
        expect(creditedBefore.has(returnId)).toBe(false);

        // 3. Confirmar una nota de crédito que acredita la devolución
        const noteId = SupplierCreditNoteId.of(`c0000000-0000-4000-8000-${next()}`);
        const note = SupplierCreditNote.draft(
          noteId,
          tenant,
          `NCP${next().slice(-6)}`,
          {
            supplierId: SUPPLIER,
            invoiceId: INVOICE,
            purchaseReturnId: returnId,
            issueDate: PayablesDate.of(TODAY),
            reason: 'return',
            currency: USD_VES_RATES,
            lines: [
              {
                id: `e0000000-0000-4000-8000-${next()}`,
                concept: 'Devolución',
                quantity: 1,
                unitPrice: 10,
                taxRate: 0,
              },
            ],
          },
          NOW,
          TODAY,
        );
        await ports.creditNotes.save(note);
        await ports.creditNotePosting.confirm(tenant, noteId, NOW, TODAY);

        // 4. Tras confirmar la nota, confirmedCreditedReturnIds incluye returnId
        const creditedAfter = await ports.creditNotes.confirmedCreditedReturnIds(tenant);
        expect(creditedAfter.has(returnId)).toBe(true);
      });
    });
  });
}

