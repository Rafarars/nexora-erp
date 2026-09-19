import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReportCustomerNotFoundError } from '../../domain/errors/reporting.errors.js';
import { ReportPage, pageOf } from '../../domain/page/report-page.js';
import { ReportCustomer, ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { amountUnits, unitsToNumber } from '../../domain/shared/money.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CustomerStatementResponse {
  asOf: string;
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;
  // Los decimales de la empresa: la pantalla y el PDF escriben el importe igual.
  decimals: number;

  page: ReportPage;

  customer: ReportCustomer;
  // Cubren TODAS las facturas del cliente, no solo la pagina de movimientos enviada.
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
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; customerId: string; limit?: number; offset?: number }): Promise<CustomerStatementResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const [today, decimals, currency] = await Promise.all([
      this.calendar.today(request.tenantId).then((day) => ReportDate.of(day)),
      this.rates.amountDecimals(request.tenantId),
      this.rates.companyCurrency(request.tenantId),
    ]);
    const customer = (await this.readModel.customers(tenantId)).find((candidate) => candidate.id === request.customerId);

    if (!customer) throw new ReportCustomerNotFoundError(request.customerId);

    const [entries, invoices] = await Promise.all([
      this.readModel.statementEntries(tenantId, customer.id, decimals),
      this.readModel.issuedInvoices(tenantId, decimals, customer.id),
    ]);
    let running = 0n;

    const movements = [...entries]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? a.code.localeCompare(b.code) : a.type === 'invoice' ? -1 : 1))
      .map((entry) => {
        const units = amountUnits(entry.amount);

        running += entry.type === 'invoice' ? units : -units;

        return {
          date: entry.date,
          type: entry.type,
          code: entry.code,
          debit: entry.type === 'invoice' ? entry.amount : 0,
          credit: entry.type === 'payment' ? entry.amount : 0,
          balance: unitsToNumber(running),
        };
      });

    const owed = invoices.map((invoice) => ({ dueDate: invoice.dueDate, units: amountUnits(invoice.balance) })).filter((row) => row.units > 0n);

    // Se pagina el final, no el principio: el saldo corrido se lee de arriba abajo y lo ultimo es
    // lo que importa, asi que la primera pagina ensena los movimientos mas recientes.
    const shown = pageOf([...movements].reverse(), request.limit, request.offset);

    return {
      asOf: today.value,
      currency,
      decimals,
      page: shown.page,
      customer,
      balance: unitsToNumber(owed.reduce((sum, row) => sum + row.units, 0n)),
      overdue: unitsToNumber(owed.filter((row) => row.dueDate < today.value).reduce((sum, row) => sum + row.units, 0n)),
      movements: [...shown.rows].reverse(),
    };
  }
}
