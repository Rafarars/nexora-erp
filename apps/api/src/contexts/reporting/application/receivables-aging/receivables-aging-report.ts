import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ReceivablesAgingResponse {
  asOf: string;
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;

  customers: { customer: { id: string; code: string; name: string }; aging: AgingTotals }[];
  totals: AgingTotals;
}

// La antiguedad de saldos al dia de hoy, por cliente con saldo, en orden de nombre.
export class ReceivablesAgingReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string }): Promise<ReceivablesAgingResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const [today, decimals, currency] = await Promise.all([
      this.calendar.today(request.tenantId).then((day) => ReportDate.of(day)),
      this.rates.amountDecimals(request.tenantId),
      this.rates.companyCurrency(request.tenantId),
    ]);
    const [customers, invoices] = await Promise.all([this.readModel.customers(tenantId), this.readModel.issuedInvoices(tenantId, decimals)]);
    const balances = invoices.map((invoice) => ({ customerId: invoice.customerId, dueDate: invoice.dueDate, balance: invoice.balance }));

    return {
      asOf: today.value,
      currency,
      customers: customers
        .map((customer) => ({
          customer: { id: customer.id, code: customer.code, name: customer.name },
          aging: agingOf(balances.filter((row) => row.customerId === customer.id), today),
        }))
        .filter((row) => row.aging.total > 0),
      totals: agingOf(balances, today),
    };
  }
}
