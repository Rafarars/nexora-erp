import { ExportFormat, RenderedReport, ReportRenderer, exportFormat } from '../../domain/document/report-document.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CustomerStatementReport } from '../customer-statement/customer-statement-report.js';
import { InventoryValuationReport } from '../inventory-valuation/inventory-valuation-report.js';
import { ReceivablesAgingReport } from '../receivables-aging/receivables-aging-report.js';
import { SalesByCustomerReport } from '../sales-by-customer/sales-by-customer-report.js';
import { customerStatementDocument, inventoryValuationDocument, receivablesAgingDocument, salesByCustomerDocument } from './report-documents.js';

// Exportar es correr el mismo reporte de la pantalla, convertirlo en documento y escribirlo. El
// formato se valida antes de consultar nada.
export class ReportExports {
  constructor(
    private readonly aging: ReceivablesAgingReport,
    private readonly statement: CustomerStatementReport,
    private readonly sales: SalesByCustomerReport,
    private readonly valuation: InventoryValuationReport,
    private readonly readModel: ReportingReadModel,
    private readonly renderer: ReportRenderer,
  ) {}

  async receivablesAging(request: { tenantId: string }, format: string | undefined): Promise<RenderedReport> {
    const chosen = exportFormat(format);

    return this.write(chosen, request.tenantId, async (company) => receivablesAgingDocument(await this.aging.run(request), company));
  }

  async customerStatement(request: { tenantId: string; customerId: string }, format: string | undefined): Promise<RenderedReport> {
    const chosen = exportFormat(format);

    return this.write(chosen, request.tenantId, async (company) => customerStatementDocument(await this.statement.run(request), company));
  }

  async salesByCustomer(request: { tenantId: string; from: string; to: string }, format: string | undefined): Promise<RenderedReport> {
    const chosen = exportFormat(format);

    return this.write(chosen, request.tenantId, async (company) => salesByCustomerDocument(await this.sales.run(request), company));
  }

  async inventoryValuation(request: { tenantId: string; warehouseId?: string }, format: string | undefined): Promise<RenderedReport> {
    const chosen = exportFormat(format);

    return this.write(chosen, request.tenantId, async (company) => {
      const report = await this.valuation.run(request);

      return inventoryValuationDocument(report, company, request.warehouseId ? (report.rows[0]?.warehouse.name ?? null) : null);
    });
  }

  private async write(format: ExportFormat, tenantId: string, build: (company: string) => Promise<Parameters<ReportRenderer['render']>[0]>): Promise<RenderedReport> {
    const company = await this.readModel.companyName(TenantId.of(tenantId));

    return this.renderer.render(await build(company), format);
  }
}
