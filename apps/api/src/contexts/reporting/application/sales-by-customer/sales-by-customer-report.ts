import { ReportPeriod } from '../../domain/period/report-period.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { sumCents } from '../../domain/shared/money.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesByCustomerResponse {
  period: { from: string; to: string };
  customers: { customer: { id: string; code: string; name: string }; invoices: number; subtotal: number; tax: number; total: number }[];
  totals: { invoices: number; subtotal: number; tax: number; total: number };
}

// Lo facturado en un periodo por cliente, sin las facturas anuladas. El que mas compro, primero.
export class SalesByCustomerReport {
  constructor(private readonly readModel: ReportingReadModel) {}

  async run(request: { tenantId: string; from: string; to: string }): Promise<SalesByCustomerResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const period = ReportPeriod.of(request.from, request.to);
    const [customers, sales] = await Promise.all([this.readModel.customers(tenantId), this.readModel.salesByCustomer(tenantId, period)]);

    const rows = sales
      .map((row) => {
        const customer = customers.find((candidate) => candidate.id === row.customerId);

        return { customer: { id: row.customerId, code: customer?.code ?? '', name: customer?.name ?? '' }, invoices: row.invoices, subtotal: row.subtotal, tax: row.tax, total: row.total };
      })
      .sort((a, b) => b.total - a.total || a.customer.name.localeCompare(b.customer.name));

    return {
      period: { from: period.from.value, to: period.to.value },
      customers: rows,
      totals: {
        invoices: rows.reduce((sum, row) => sum + row.invoices, 0),
        subtotal: sumCents(rows.map((row) => row.subtotal)),
        tax: sumCents(rows.map((row) => row.tax)),
        total: sumCents(rows.map((row) => row.total)),
      },
    };
  }
}
