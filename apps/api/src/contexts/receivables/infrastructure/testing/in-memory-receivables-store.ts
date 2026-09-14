import { PaymentNotEditableError, PaymentNotFoundError } from '../../domain/errors/receivables.errors.js';
import { ReceivableInvoice, ReceivableInvoicePrimitives } from '../../domain/ledger/receivable-invoice.js';
import { ReceivableCustomer, ReceivablesLedger } from '../../domain/ledger/receivables-ledger.js';
import { CustomerPayment, PaymentPrimitives } from '../../domain/payment/customer-payment.entity.js';
import { PaymentRepository } from '../../domain/payment/payment.repository.js';
import { PaymentPosting } from '../../domain/payment/posting/payment-posting.js';
import { toCents } from '../../domain/shared/amount.js';

type InvoiceRow = Omit<ReceivableInvoicePrimitives, 'paid'> & { tenantId: string };

// Clientes y facturas de ventas mas los cobros, en un solo almacen: lo cobrado de una factura sale
// de los cobros confirmados, como en la base. Las publicaciones van de una en una y una que falla
// no deja nada escrito.
export class InMemoryReceivablesStore {
  private readonly customerRows = new Map<string, ReceivableCustomer & { tenantId: string }>();
  private readonly invoiceRows = new Map<string, InvoiceRow>();
  private readonly paymentRows = new Map<string, PaymentPrimitives>();
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
      customers: async (tenantId) =>
        [...this.customerRows.values()]
          .filter((row) => row.tenantId === tenantId.value)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ tenantId: _tenant, ...customer }) => ({ ...customer })),
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
    };
  }

  get posting(): PaymentPosting {
    return {
      post: (tenantId, paymentId, work) =>
        this.serial(async () => {
          const row = this.paymentRows.get(paymentId.value);

          if (!row || row.tenantId !== tenantId.value) throw new PaymentNotFoundError(paymentId.value);

          const payment = CustomerPayment.fromPrimitives(row);
          const invoices = this.invoicesOf(tenantId.value, { ids: payment.invoiceIds() }, payment.id.value);

          work(payment, invoices);
          this.paymentRows.set(row.id, payment.toPrimitives());
        }),
    };
  }

  private invoicesOf(tenantId: string, filter: { customerId?: string; ids?: string[] }, excludedPayment?: string): ReceivableInvoice[] {
    return [...this.invoiceRows.values()]
      .filter((row) => row.tenantId === tenantId && (!filter.customerId || row.customerId === filter.customerId) && (!filter.ids || filter.ids.includes(row.id)))
      .sort((a, b) => b.code.localeCompare(a.code))
      .map(({ tenantId: _tenant, ...row }) => ReceivableInvoice.of({ ...row, paid: this.paidOf(row.id, excludedPayment) }));
  }

  private paidOf(invoiceId: string, excludedPayment?: string): number {
    const cents = [...this.paymentRows.values()]
      .filter((payment) => payment.status === 'confirmed' && payment.id !== excludedPayment)
      .flatMap((payment) => payment.allocations)
      .filter((allocation) => allocation.invoiceId === invoiceId)
      .reduce((sum, allocation) => sum + toCents(allocation.amount), 0n);

    return Number(cents) / 100;
  }

  // En serie, como el bloqueo de filas de la base.
  private serial(run: () => Promise<void>): Promise<void> {
    const next = this.queue.then(run);

    this.queue = next.catch(() => undefined);

    return next;
  }
}
