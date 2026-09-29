import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { PayableInvoice } from '../../domain/ledger/payable-invoice.js';
import { PayableSupplier, PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SupplierBalanceResponse {
  supplier: { id: string; code: string; name: string; isActive: boolean };
  paymentTermDays: number;
  balance: number;
  overdue: number;
  aging: AgingTotals;
}

export interface SupplierBalanceSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  suppliers: SupplierBalanceResponse[];
  totals: AgingTotals;
}

const DEFAULT_PAGE = 20;

export class SupplierBalanceSearcher {
  constructor(
    private readonly ledger: PayablesLedger,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    onlyWithBalance?: 'true' | 'false';
    limit?: number;
    offset?: number;
  }): Promise<SupplierBalanceSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = PayablesDate.of(await this.calendar.today(request.tenantId));
    const [suppliers, invoices, decimals] = await Promise.all([
      this.ledger.suppliers(tenantId, { text: request.q?.trim() ? request.q.trim() : null }),
      this.ledger.invoices(tenantId, { onlyConfirmed: true }),
      this.rates.amountDecimals(request.tenantId),
    ]);

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const matched = new Set(suppliers.map((supplier) => supplier.id));
    const all = suppliers
      .map((supplier) => supplierBalance(supplier, invoices.filter((invoice) => invoice.supplierId() === supplier.id), today, decimals))
      .filter((row) => request.onlyWithBalance === 'false' || row.balance > 0);

    return {
      total: all.length,
      limit,
      offset,
      hasMore: offset + Math.max(0, Math.min(limit, all.length - offset)) < all.length,
      suppliers: all.slice(offset, offset + limit),
      totals: agingOf(invoices.filter((invoice) => matched.has(invoice.supplierId())), today, decimals),
    };
  }
}

export function supplierBalance(
  supplier: PayableSupplier,
  invoices: PayableInvoice[],
  today: PayablesDate,
  decimals: number,
): SupplierBalanceResponse {
  const aging = agingOf(invoices, today, decimals);
  const overdue = invoices.filter((invoice) => invoice.isOverdue(today)).reduce((sum, invoice) => sum + invoice.companyBalanceUnits(decimals), 0n);

  return {
    supplier: { id: supplier.id, code: supplier.code, name: supplier.name, isActive: supplier.isActive },
    paymentTermDays: supplier.paymentTermDays,
    balance: aging.total,
    overdue: unitsToNumber(overdue),
    aging,
  };
}
