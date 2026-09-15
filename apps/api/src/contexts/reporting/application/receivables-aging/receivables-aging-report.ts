import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ReceivablesAgingResponse {
  asOf: string;
  customers: { customer: { id: string; code: string; name: string }; aging: AgingTotals }[];
  totals: AgingTotals;
}

// La antiguedad de saldos al dia de hoy, por cliente con saldo, en orden de nombre.
export class ReceivablesAgingReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string }): Promise<ReceivablesAgingResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReportDate.of(await this.calendar.today(request.tenantId));
    const [customers, invoices] = await Promise.all([this.readModel.customers(tenantId), this.readModel.issuedInvoices(tenantId)]);
    const balances = invoices.map((invoice) => ({ customerId: invoice.customerId, dueDate: invoice.dueDate, balance: invoice.total - invoice.paid }));

    return {
      asOf: today.value,
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
