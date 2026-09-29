import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  InvoiceNotPayableError,
  InvoiceOfAnotherSupplierError,
  PaymentAlreadyCancelledError,
  PaymentExceedsBalanceError,
  PaymentNotEditableError,
  PaymentNotFoundError,
} from '../domain/errors/payables.errors.js';
import { SupplierPayment, PaymentDetails, PaymentId } from '../domain/payment/supplier-payment.entity.js';
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
import { PayablesPorts, PayablesPortsHarness } from './payables-ports.harness.js';

const tenant = TenantId.of(TENANT_A);
const FOREIGN_SUPPLIER = 'e8999999-9999-4999-8999-999999999999';
const FOREIGN_INVOICE = 'f9999999-9999-4999-8999-999999999999';

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
  });
}
