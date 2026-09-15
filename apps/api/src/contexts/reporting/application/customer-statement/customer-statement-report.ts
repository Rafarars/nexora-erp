import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { ReportCustomerNotFoundError } from '../../domain/errors/reporting.errors.js';
import { ReportCustomer, ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { centsToNumber, toCents } from '../../domain/shared/money.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CustomerStatementResponse {
  asOf: string;
  customer: ReportCustomer;
  balance: number;
  overdue: number;
  movements: { date: string; type: 'invoice' | 'payment'; code: string; debit: number; credit: number; balance: number }[];
}

// El estado de cuenta para imprimir: facturas emitidas y cobros confirmados con saldo corrido. El
// ultimo saldo es lo que deben sus facturas.
export class CustomerStatementReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; customerId: string }): Promise<CustomerStatementResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReportDate.of(await this.calendar.today(request.tenantId));
    const customer = (await this.readModel.customers(tenantId)).find((candidate) => candidate.id === request.customerId);

    if (!customer) throw new ReportCustomerNotFoundError(request.customerId);

    const [entries, invoices] = await Promise.all([this.readModel.statementEntries(tenantId, customer.id), this.readModel.issuedInvoices(tenantId, customer.id)]);
    let running = 0n;

    const movements = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1))
      .map((entry) => {
        const cents = toCents(entry.amount);

        running += entry.type === 'invoice' ? cents : -cents;

        return {
          date: entry.date,
          type: entry.type,
          code: entry.code,
          debit: entry.type === 'invoice' ? entry.amount : 0,
          credit: entry.type === 'payment' ? entry.amount : 0,
          balance: centsToNumber(running),
        };
      });

    const owed = invoices.map((invoice) => ({ dueDate: invoice.dueDate, cents: toCents(invoice.total) - toCents(invoice.paid) })).filter((row) => row.cents > 0n);

    return {
      asOf: today.value,
      customer,
      balance: centsToNumber(owed.reduce((sum, row) => sum + row.cents, 0n)),
      overdue: centsToNumber(owed.filter((row) => row.dueDate < today.value).reduce((sum, row) => sum + row.cents, 0n)),
      movements,
    };
  }
}
