import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  DuplicateSupplierInvoiceNumberError,
  InactiveSupplierError,
  PurchaseInvoiceNotFoundError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseInvoiceReferences, PurchaseInvoiceLineInput } from '../../domain/invoice/lines/purchase-invoice-references.js';
import { PurchaseInvoiceId } from '../../domain/invoice/purchase-invoice-id.vo.js';
import { PurchaseInvoice } from '../../domain/invoice/purchase-invoice.entity.js';
import { PurchaseInvoiceRepository } from '../../domain/invoice/purchase-invoice.repository.js';
import { SupplierInvoiceNumber } from '../../domain/invoice/supplier-invoice-number.vo.js';
import { PurchaseDate } from '../../domain/shared/purchase-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';

export interface PurchaseInvoiceUpdaterRequest {
  tenantId: string;
  invoiceId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceSeries?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  lines: PurchaseInvoiceLineInput[];
}

export class PurchaseInvoiceUpdater {
  constructor(
    private readonly suppliers: SupplierFinder,
    private readonly references: PurchaseInvoiceReferences,
    private readonly invoices: PurchaseInvoiceRepository,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PurchaseInvoiceUpdaterRequest): Promise<PurchaseInvoice> {
    const tenantId = TenantId.of(request.tenantId);
    const invoiceId = PurchaseInvoiceId.of(request.invoiceId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const invoice = await this.invoices.findById(tenantId, invoiceId);
    if (!invoice) {
      throw new PurchaseInvoiceNotFoundError(request.invoiceId);
    }

    const supplier = await this.suppliers.find(tenantId, SupplierId.of(request.supplierId));
    if (!supplier.isActive()) {
      throw new InactiveSupplierError(supplier.id.value);
    }

    const supplierInvoiceNumber = SupplierInvoiceNumber.of(request.supplierInvoiceNumber);

    // Verificar unicidad excluyendo la propia factura
    const existing = await this.invoices.findActiveBySupplierNumber(
      tenantId,
      supplier.id,
      supplierInvoiceNumber.value,
    );
    if (existing && !existing.id.equals(invoice.id)) {
      throw new DuplicateSupplierInvoiceNumberError(supplier.id.value, supplierInvoiceNumber.value);
    }

    const issueDate = request.issueDate ? PurchaseDate.of(request.issueDate) : PurchaseDate.of(today);
    issueDate.ensureNotAfter(today);

    let dueDate: PurchaseDate;
    if (request.dueDate) {
      dueDate = PurchaseDate.of(request.dueDate);
    } else {
      const paymentTermDays = supplier.toPrimitives().paymentTermDays;
      const d = new Date(issueDate.value);
      d.setUTCDate(d.getUTCDate() + paymentTermDays);
      dueDate = PurchaseDate.fromDate(d);
    }

    const lines = await this.references.lines(tenantId, request.lines);

    const currencyPrimitives = await this.rates.forDocument(tenantId.value, {
      currency: request.currency ?? invoice.currency.currency,
      date: issueDate.value,
      manualRate: request.exchangeRate ?? invoice.currency.manualRate(),
      keepsCurrency: true,
    });
    const currency = DocumentCurrency.of(currencyPrimitives);

    invoice.update(
      {
        supplierId: supplier.id,
        supplierInvoiceNumber,
        supplierInvoiceSeries: request.supplierInvoiceSeries ?? null,
        issueDate,
        dueDate,
        notes: request.notes ?? null,
        lines,
        currency,
      },
      now,
      today,
    );

    await this.invoices.save(invoice);
    return invoice;
  }
}
