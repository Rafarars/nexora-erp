import { Module } from '@nestjs/common';
import type { Clock } from '../../../shared/domain/ports/clock.js';
import { CLOCK } from '../../../shared/domain/ports/clock.js';
import { SharedModule } from '../../../shared/infrastructure/shared.module.js';
import { PrismaModule } from '../../../shared/prisma/prisma.module.js';
import { CustomerStatementReport } from '../application/customer-statement/customer-statement-report.js';
import { ReportExports } from '../application/documents/report-exports.js';
import { InventoryValuationReport } from '../application/inventory-valuation/inventory-valuation-report.js';
import { ReceivablesAgingReport } from '../application/receivables-aging/receivables-aging-report.js';
import { SalesByCustomerReport } from '../application/sales-by-customer/sales-by-customer-report.js';
import { DashboardSearcher } from '../application/search-dashboard/dashboard-searcher.js';
import { REPORT_RENDERER } from '../domain/document/report-document.js';
import type { ReportRenderer } from '../domain/document/report-document.js';
import { REPORTING_READ_MODEL } from '../domain/read-model/reporting-read-model.js';
import type { ReportingReadModel } from '../domain/read-model/reporting-read-model.js';
import { CustomerStatementGetController } from './http/customer-statement-get.controller.js';
import { ExportCustomerStatementGetController } from './http/export-customer-statement-get.controller.js';
import { InventoryValuationGetController } from './http/inventory-valuation-get.controller.js';
import { ExportInventoryValuationGetController } from './http/export-inventory-valuation-get.controller.js';
import { ReceivablesAgingGetController } from './http/receivables-aging-get.controller.js';
import { ExportReceivablesAgingGetController } from './http/export-receivables-aging-get.controller.js';
import { SalesByCustomerGetController } from './http/sales-by-customer-get.controller.js';
import { ExportSalesByCustomerGetController } from './http/export-sales-by-customer-get.controller.js';
import { SearchDashboardGetController } from './http/search-dashboard-get.controller.js';
import { PrismaReportingReadModel } from './persistence/prisma-reporting-read-model.js';
import { PdfExcelReportRenderer } from './rendering/report-renderer.js';

// El cableado de los reportes. No importa ningun modulo: lee las tablas de los demas por su
// adaptador y no escribe nada.
@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    SearchDashboardGetController,
    ReceivablesAgingGetController,
    ExportReceivablesAgingGetController,
    CustomerStatementGetController,
    ExportCustomerStatementGetController,
    SalesByCustomerGetController,
    ExportSalesByCustomerGetController,
    InventoryValuationGetController,
    ExportInventoryValuationGetController,
  ],
  providers: [
    { provide: REPORTING_READ_MODEL, useClass: PrismaReportingReadModel },
    { provide: REPORT_RENDERER, useClass: PdfExcelReportRenderer },
    { provide: DashboardSearcher, useFactory: (r: ReportingReadModel, k: Clock) => new DashboardSearcher(r, k), inject: [REPORTING_READ_MODEL, CLOCK] },
    { provide: ReceivablesAgingReport, useFactory: (r: ReportingReadModel, k: Clock) => new ReceivablesAgingReport(r, k), inject: [REPORTING_READ_MODEL, CLOCK] },
    { provide: CustomerStatementReport, useFactory: (r: ReportingReadModel, k: Clock) => new CustomerStatementReport(r, k), inject: [REPORTING_READ_MODEL, CLOCK] },
    { provide: SalesByCustomerReport, useFactory: (r: ReportingReadModel) => new SalesByCustomerReport(r), inject: [REPORTING_READ_MODEL] },
    { provide: InventoryValuationReport, useFactory: (r: ReportingReadModel) => new InventoryValuationReport(r), inject: [REPORTING_READ_MODEL] },
    {
      provide: ReportExports,
      useFactory: (a: ReceivablesAgingReport, c: CustomerStatementReport, s: SalesByCustomerReport, v: InventoryValuationReport, r: ReportingReadModel, w: ReportRenderer) =>
        new ReportExports(a, c, s, v, r, w),
      inject: [ReceivablesAgingReport, CustomerStatementReport, SalesByCustomerReport, InventoryValuationReport, REPORTING_READ_MODEL, REPORT_RENDERER],
    },
  ],
})
export class ReportingModule {}
