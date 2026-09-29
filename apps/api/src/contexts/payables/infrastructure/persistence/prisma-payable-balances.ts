import { Inject, Injectable } from '@nestjs/common';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { BUSINESS_CALENDAR } from '../../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DOCUMENT_RATES } from '../../../../shared/domain/ports/document-rates.js';
import type { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import {
  Money,
  PayableBalances,
  PurchaseInvoiceIdRef,
  ReportPayableInvoice,
  SupplierExposure,
  SupplierIdRef,
  TenantIdRef,
} from '../../../../shared/prisma/payable-balances.js';
import { agingOf } from '../../domain/aging/aging.js';
import { PayableInvoiceNotFoundError, PayableSupplierNotFoundError } from '../../domain/errors/payables.errors.js';
import { PAYABLES_LEDGER } from '../../domain/ledger/payables-ledger.js';
import type { PayablesLedger } from '../../domain/ledger/payables-ledger.js';
import { PayablesDate } from '../../domain/shared/payables-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaPayableBalances implements PayableBalances {
  constructor(
    @Inject(PAYABLES_LEDGER) private readonly ledger: PayablesLedger,
    @Inject(BUSINESS_CALENDAR) private readonly calendar: BusinessCalendar,
    @Inject(DOCUMENT_RATES) private readonly rates: DocumentRates,
  ) {}

  private toTenantId(ref: TenantIdRef): TenantId {
    return typeof ref === 'string' ? TenantId.of(ref) : TenantId.of(ref.value);
  }

  private toId(ref: SupplierIdRef | PurchaseInvoiceIdRef): string {
    return typeof ref === 'string' ? ref : ref.value;
  }

  async ofSupplier(tenantId: TenantIdRef, supplierId: SupplierIdRef): Promise<SupplierExposure> {
    const tId = this.toTenantId(tenantId);
    const sId = this.toId(supplierId);

    const supplier = await this.ledger.supplier(tId, sId);
    if (!supplier) throw new PayableSupplierNotFoundError(sId);

    const [todayStr, decimals] = await Promise.all([
      this.calendar.today(tId.value),
      this.rates.amountDecimals(tId.value),
    ]);
    const today = PayablesDate.of(todayStr);

    const invoices = await this.ledger.invoices(tId, { onlyConfirmed: true, supplierId: sId });
    const aging = agingOf(invoices, today, decimals);
    const overdueUnits = invoices
      .filter((inv) => inv.isOverdue(today))
      .reduce((sum, inv) => sum + inv.companyBalanceUnits(decimals), 0n);

    return {
      openBalance: aging.total,
      hasOverdue: overdueUnits > 0n,
      overdueBalance: unitsToNumber(overdueUnits),
      aging,
    };
  }

  async ofInvoice(tenantId: TenantIdRef, invoiceId: PurchaseInvoiceIdRef): Promise<Money> {
    const tId = this.toTenantId(tenantId);
    const iId = this.toId(invoiceId);

    const invoices = await this.ledger.invoices(tId, { ids: [iId] });
    const invoice = invoices[0];
    if (!invoice) throw new PayableInvoiceNotFoundError(iId);

    return {
      amount: invoice.balance(),
      currency: invoice.currency().currency,
    };
  }

  async allInvoices(tenantId: TenantIdRef, decimals: number): Promise<ReportPayableInvoice[]> {
    const tId = this.toTenantId(tenantId);
    const invoices = await this.ledger.invoices(tId, { onlyConfirmed: true });

    return invoices.map((inv) => ({
      id: inv.id,
      code: inv.code,
      supplierId: inv.supplierId(),
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      total: inv.companyTotal(decimals),
      paid: inv.companyPaid(decimals),
      balance: inv.companyBalance(decimals),
    }));
  }

  async totalBalance(tenantId: TenantIdRef, decimals: number): Promise<number> {
    const tId = this.toTenantId(tenantId);
    const invoices = await this.ledger.invoices(tId, { onlyConfirmed: true });
    const totalUnits = invoices.reduce((sum, inv) => sum + inv.companyBalanceUnits(decimals), 0n);
    return unitsToNumber(totalUnits);
  }
}
