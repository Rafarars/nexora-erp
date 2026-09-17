import { FixedDocumentRates } from '../../../../shared/infrastructure/testing/fixed-document-rates.js';
import { ClockBusinessCalendar } from '../../../../shared/infrastructure/testing/clock-business-calendar.js';
import { FixedClock } from '../../../../shared/infrastructure/testing/fixed-clock.js';
import { NOW } from '../../domain/testing/reporting.mother.js';
import { InMemoryReportingReadModel } from '../../infrastructure/testing/in-memory-reporting-read-model.js';
import { CustomerStatementReport } from '../customer-statement/customer-statement-report.js';
import { InventoryValuationReport } from '../inventory-valuation/inventory-valuation-report.js';
import { ReceivablesAgingReport } from '../receivables-aging/receivables-aging-report.js';
import { SalesByCustomerReport } from '../sales-by-customer/sales-by-customer-report.js';
import { DashboardSearcher } from '../search-dashboard/dashboard-searcher.js';

export function aReportingScenario() {
  const clock = new FixedClock(NOW);
  const calendar = new ClockBusinessCalendar(clock);
  const readModel = new InMemoryReportingReadModel();
  const rates = new FixedDocumentRates();

  return {
    clock,
    calendar,
    readModel,
    rates,
    dashboard: new DashboardSearcher(readModel, calendar, rates),
    receivablesAging: new ReceivablesAgingReport(readModel, calendar, rates),
    customerStatement: new CustomerStatementReport(readModel, calendar, rates),
    salesByCustomer: new SalesByCustomerReport(readModel, rates),
    inventoryValuation: new InventoryValuationReport(readModel, rates),
  };
}
