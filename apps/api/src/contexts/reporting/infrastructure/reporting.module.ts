import { DOCUMENT_RATES } from '../../../shared/domain/ports/document-rates.js';
import type { DocumentRates } from '../../../shared/domain/ports/document-rates.js';
import { BUSINESS_CALENDAR } from '../../../shared/domain/ports/business-calendar.js';
import type { BusinessCalendar } from '../../../shared/domain/ports/business-calendar.js';
import { Module } from '@nestjs/common';
import { CompanyModule } from '../../company/infrastructure/company.module.js';
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
  imports: [PrismaModule, SharedModule, CompanyModule],
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
    {
      provide: DashboardSearcher,
      useFactory: (r: ReportingReadModel, cal: BusinessCalendar, dr: DocumentRates) => new DashboardSearcher(r, cal, dr),
      inject: [REPORTING_READ_MODEL, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: ReceivablesAgingReport,
      useFactory: (r: ReportingReadModel, cal: BusinessCalendar, dr: DocumentRates) => new ReceivablesAgingReport(r, cal, dr),
      inject: [REPORTING_READ_MODEL, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    {
      provide: CustomerStatementReport,
      useFactory: (r: ReportingReadModel, cal: BusinessCalendar, dr: DocumentRates) => new CustomerStatementReport(r, cal, dr),
      inject: [REPORTING_READ_MODEL, BUSINESS_CALENDAR, DOCUMENT_RATES],
    },
    { provide: SalesByCustomerReport, useFactory: (r: ReportingReadModel, dr: DocumentRates) => new SalesByCustomerReport(r, dr), inject: [REPORTING_READ_MODEL, DOCUMENT_RATES] },
    { provide: InventoryValuationReport, useFactory: (r: ReportingReadModel, dr: DocumentRates) => new InventoryValuationReport(r, dr), inject: [REPORTING_READ_MODEL, DOCUMENT_RATES] },
    {
      provide: ReportExports,
      useFactory: (a: ReceivablesAgingReport, c: CustomerStatementReport, s: SalesByCustomerReport, v: InventoryValuationReport, r: ReportingReadModel, w: ReportRenderer, cal: BusinessCalendar) =>
        new ReportExports(a, c, s, v, r, w, cal),
      inject: [ReceivablesAgingReport, CustomerStatementReport, SalesByCustomerReport, InventoryValuationReport, REPORTING_READ_MODEL, REPORT_RENDERER, BUSINESS_CALENDAR],
    },
  ],
})
export class ReportingModule {}
