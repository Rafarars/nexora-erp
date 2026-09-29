import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { AgingBucket, bucketOf } from '../../domain/aging/aging.js';
import { PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PayableCollectionStatus } from '../../domain/ledger/payable-invoice.js';
import { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PayableInvoiceResponse {
  id: string;
  code: string;
  supplier: { id: string; code: string; name: string };
  issueDate: string;
  dueDate: string;
  // En la moneda de la factura
  currency: string;
  total: number;
  paid: number;
  balance: number;
  // Lo que debe en la moneda de la empresa, con las tasas de su emision
  companyBalance: number;
  status: PayableCollectionStatus;
  daysOverdue: number;
  bucket: AgingBucket | null;
}

export interface PayableInvoiceSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  invoices: PayableInvoiceResponse[];
}

export type PayableSearchStatus = Exclude<PayableCollectionStatus, 'cancelled'>;

const DEFAULT_PAGE = 20;

export class PayableInvoiceSearcher {
  constructor(
    private readonly ledger: PayablesLedger,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    supplierId?: string | null;
    status?: PayableSearchStatus;
    from?: string | null;
    to?: string | null;
    onlyOverdue?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<PayableInvoiceSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = PayablesDate.of(await this.calendar.today(request.tenantId));

    if (request.supplierId) {
      const supplier = await this.ledger.supplier(tenantId, request.supplierId);
      if (!supplier) throw new PayableSupplierNotFoundError(request.supplierId);
    }

    const [suppliers, invoices, decimals] = await Promise.all([
      this.ledger.suppliers(tenantId),
      this.ledger.invoices(tenantId, {
        onlyConfirmed: true,
        supplierId: request.supplierId ?? null,
        text: request.q?.trim() ? request.q.trim() : null,
        from: request.from ?? null,
        to: request.to ?? null,
      }),
      this.rates.amountDecimals(request.tenantId),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const all = invoices
      .map((invoice) => {
        const row = invoice.toPrimitives();
        const supplier = suppliers.find((candidate) => candidate.id === row.supplierId);

        return {
          id: row.id,
          code: row.code,
          supplier: { id: row.supplierId, code: supplier?.code ?? '', name: supplier?.name ?? '' },
          issueDate: row.issueDate,
          dueDate: row.dueDate,
          currency: row.currency,
          total: row.total,
          paid: row.paid,
          balance: invoice.balance(),
          companyBalance: invoice.companyBalance(decimals),
          status: invoice.paymentStatus(),
          daysOverdue: invoice.daysOverdue(today),
          bucket: bucketOf(invoice, today),
        };
      })
      .filter((row) => !request.status || row.status === request.status)
      .filter((row) => request.onlyOverdue !== 'true' || row.daysOverdue > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code));

    return {
      total: all.length,
      limit,
      offset,
      hasMore: offset + Math.max(0, Math.min(limit, all.length - offset)) < all.length,
      invoices: all.slice(offset, offset + limit),
    };
  }
}
