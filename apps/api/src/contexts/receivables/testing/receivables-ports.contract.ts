import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvoiceNotPayableError, PaymentExceedsBalanceError, PaymentNotEditableError, PaymentNotFoundError } from '../domain/errors/receivables.errors.js';
import { CustomerPayment, PaymentAllocationPrimitives, PaymentId } from '../domain/payment/customer-payment.entity.js';
import { ReceivablesDate } from '../domain/shared/receivables-date.vo.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';
import { CUSTOMER, INVOICE, NOW, OTHER_CUSTOMER, OTHER_INVOICE, TENANT_A, TENANT_B, TODAY } from '../domain/testing/receivables.mother.js';
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
      await harness.invoice(TENANT_A, { id: INVOICE, code: 'FAC900002', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 100 });
      await harness.invoice(TENANT_A, { id: OTHER_INVOICE, code: 'FAC900001', customerId: OTHER_CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'issued', total: 30.3 });
      await harness.invoice(TENANT_B, { id: FOREIGN_INVOICE, code: 'FAC900001', customerId: FOREIGN_CUSTOMER, issueDate: '2026-01-02', dueDate: '2026-01-02', status: 'issued', total: 10 });
    });

    afterEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    const next = () => String((counter += 1)).padStart(12, '0');
    const allocation = (invoiceId: string, amount: number): PaymentAllocationPrimitives => ({ id: `da000000-0000-4000-8000-${next()}`, invoiceId, amount });

    async function draft(allocations: PaymentAllocationPrimitives[], customerId = CUSTOMER): Promise<PaymentId> {
      const id = PaymentId.of(`d0000000-0000-4000-8000-${next()}`);

      await ports.payments.save(
        CustomerPayment.draft(id, tenant, `COB${next().slice(-6)}`, { customerId, date: ReceivablesDate.of(TODAY), method: 'transfer', reference: 'TRF', notes: 'contrato', allocations }, NOW),
      );

      return id;
    }

    const confirm = (id: PaymentId) => ports.posting.post(tenant, id, (payment, invoices) => payment.confirm(invoices, NOW));
    const cancel = (id: PaymentId) => ports.posting.post(tenant, id, (payment) => payment.cancel(NOW));
    const invoice = async (id = INVOICE) => (await ports.ledger.invoices(tenant, { ids: [id] }))[0];

    describe('PaymentRepository', () => {
      it('saves a draft with what it applies, and rewrites it when edited', async () => {
        const id = await draft([allocation(INVOICE, 40.1), allocation(OTHER_INVOICE, 0.2)]);
        const stored = (await ports.payments.find(tenant, id))!;

        expect(stored.toPrimitives()).toMatchObject({ status: 'draft', amount: 40.3, paymentDate: TODAY, method: 'transfer', notes: 'contrato' });

        const kept = stored.toPrimitives().allocations[0];
        stored.update({ customerId: CUSTOMER, date: ReceivablesDate.of('2026-01-10'), method: 'cash', allocations: [{ ...kept, amount: 12 }] }, NOW);
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

      it('filters invoices by customer or id and never crosses companies', async () => {
        expect((await ports.ledger.invoices(tenant)).map((row) => row.toPrimitives().code)).toEqual(['FAC900002', 'FAC900001']);
        expect((await ports.ledger.invoices(tenant, { customerId: OTHER_CUSTOMER })).map((row) => row.id)).toEqual([OTHER_INVOICE]);
        expect(await ports.ledger.invoices(tenant, { ids: [FOREIGN_INVOICE] })).toEqual([]);
        expect((await invoice()).toPrimitives()).toEqual({ id: INVOICE, code: 'FAC900002', customerId: CUSTOMER, issueDate: '2026-01-05', dueDate: '2026-01-20', status: 'issued', total: 100, paid: 0 });
      });
    });

    describe('ReceivablesCodeSequence', () => {
      it('counts per tenant', async () => {
        expect(await ports.codes.next(tenant, 'COB')).toBe(1);
        expect(await ports.codes.next(tenant, 'COB')).toBe(2);
        expect(await ports.codes.next(TenantId.of(TENANT_B), 'COB')).toBe(1);
      });
    });
  });
}
