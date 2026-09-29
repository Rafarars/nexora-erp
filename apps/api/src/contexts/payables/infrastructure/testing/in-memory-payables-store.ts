import { amountUnits, unitsToNumber } from '../../../../shared/domain/amount.js';
import {
  PaymentAlreadyCancelledError,
  PaymentNotEditableError,
  PaymentNotFoundError,
  PayableInvoiceNotFoundError,
} from '../../domain/errors/payables.errors.js';
import { PayableInvoice, PayableInvoicePrimitives } from '../../domain/ledger/payable-invoice.js';
import { PayableInvoiceFilter, PayableSupplier, PayableSupplierFilter, PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PaymentId, PaymentPrimitives, SupplierPayment } from '../../domain/payment/supplier-payment.entity.js';
import { SupplierPaymentCriteria, SupplierPaymentPage, SupplierPaymentRepository } from '../../domain/payment/payment.repository.js';
import { SupplierPaymentPosting } from '../../domain/payment/posting/supplier-payment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

type InvoiceRow = Omit<PayableInvoicePrimitives, 'paid'> & { tenantId: string };

// Proveedores y facturas de compras mas los pagos, en un solo almacen: lo pagado
// de una factura sale de los pagos confirmados, como en la base. Las publicaciones van de una en
// una y una que falla no deja nada escrito.
export class InMemoryPayablesStore {
  private readonly supplierRows = new Map<string, PayableSupplier & { tenantId: string }>();
  private readonly invoiceRows = new Map<string, InvoiceRow>();
  private readonly paymentRows = new Map<string, PaymentPrimitives>();
  private readonly amountDecimalsByTenant = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();

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

  cancelInvoice(invoiceId: string): void {
    const row = this.invoiceRows.get(invoiceId);
    if (row) this.invoiceRows.set(invoiceId, { ...row, status: 'cancelled' });
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
    };
  }

  get payments(): SupplierPaymentRepository {
    return {
      save: async (payment: SupplierPayment): Promise<void> => {
        const row = payment.toPrimitives();
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
      post: async (tenantId: TenantId, paymentId: PaymentId, work: (payment: SupplierPayment, invoices: PayableInvoice[]) => void): Promise<void> => {
        await (this.queue = this.queue.then(async () => {
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

          this.paymentRows.set(paymentId.value, payment.toPrimitives());
        }));
      },
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
}
