import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { AgingTotals, agingOf } from '../../domain/aging/aging.js';
import { ReportPage, pageOf } from '../../domain/page/report-page.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PayablesAgingResponse {
  asOf: string;
  // La moneda de la empresa: cada documento llega convertido a ella con sus propias tasas.
  currency: string;
  // Los decimales de la empresa: la pantalla y el PDF escriben el importe igual.
  decimals: number;

  page: ReportPage;

  suppliers: { supplier: { id: string; code: string; name: string }; aging: AgingTotals }[];
  // Cubren TODAS las filas, no solo la pagina enviada.
  totals: AgingTotals;
}

// La antiguedad de saldos al dia de hoy, por proveedor con saldo, en orden de nombre.
export class PayablesAgingReport {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; limit?: number; offset?: number }): Promise<PayablesAgingResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const [today, decimals, currency] = await Promise.all([
      this.calendar.today(request.tenantId).then((day) => ReportDate.of(day)),
      this.rates.amountDecimals(request.tenantId),
      this.rates.companyCurrency(request.tenantId),
    ]);
    const [suppliers, invoices] = await Promise.all([
      this.readModel.suppliers(tenantId),
      this.readModel.payableInvoices(tenantId, decimals),
    ]);
    const balances = invoices.map((invoice) => ({ supplierId: invoice.supplierId, dueDate: invoice.dueDate, balance: invoice.balance }));

    // Agrupado una vez, en vez de recorrer todas las facturas por cada proveedor.
    const bySupplier = new Map<string, typeof balances>();

    for (const row of balances) bySupplier.set(row.supplierId, [...(bySupplier.get(row.supplierId) ?? []), row]);

    const rows = suppliers
      .map((supplier) => ({
        supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
        aging: agingOf(bySupplier.get(supplier.id) ?? [], today),
      }))
      .filter((row) => row.aging.total > 0);
    const shown = pageOf(rows, request.limit, request.offset);

    return {
      asOf: today.value,
      currency,
      decimals,
      page: shown.page,
      suppliers: shown.rows,
      totals: agingOf(balances, today),
    };
  }
}
