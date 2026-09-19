import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ReportPage, pageOf } from '../../domain/page/report-page.js';
import { ReportPeriod } from '../../domain/period/report-period.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { sumAmounts } from '../../domain/shared/money.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesByCustomerResponse {
  period: { from: string; to: string };
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;
  // Los decimales de la empresa: la pantalla y el PDF escriben el importe igual.
  decimals: number;

  page: ReportPage;

  customers: { customer: { id: string; code: string; name: string }; invoices: number; subtotal: number; tax: number; total: number }[];
  // Cubren TODAS las filas, no solo la pagina enviada.
  totals: { invoices: number; subtotal: number; tax: number; total: number };
}

// Lo facturado en un periodo por cliente, sin las facturas anuladas. El que mas compro, primero.
export class SalesByCustomerReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; from: string; to: string; limit?: number; offset?: number }): Promise<SalesByCustomerResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const period = ReportPeriod.of(request.from, request.to);
    const [decimals, currency] = await Promise.all([this.rates.amountDecimals(request.tenantId), this.rates.companyCurrency(request.tenantId)]);
    const [customers, sales] = await Promise.all([this.readModel.customers(tenantId), this.readModel.salesByCustomer(tenantId, period, decimals)]);

    const rows = sales
      .map((row) => {
        const customer = customers.find((candidate) => candidate.id === row.customerId);

        return { customer: { id: row.customerId, code: customer?.code ?? '', name: customer?.name ?? '' }, invoices: row.invoices, subtotal: row.subtotal, tax: row.tax, total: row.total };
      })
      .sort((a, b) => b.total - a.total || a.customer.name.localeCompare(b.customer.name));

    const shown = pageOf(rows, request.limit, request.offset);

    return {
      period: { from: period.from.value, to: period.to.value },
      currency,
      decimals,
      page: shown.page,
      customers: shown.rows,
      totals: {
        invoices: rows.reduce((sum, row) => sum + row.invoices, 0),
        subtotal: sumAmounts(rows.map((row) => row.subtotal)),
        tax: sumAmounts(rows.map((row) => row.tax)),
        total: sumAmounts(rows.map((row) => row.total)),
      },
    };
  }
}
