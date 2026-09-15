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

  return {
    clock,
    calendar,
    readModel,
    dashboard: new DashboardSearcher(readModel, calendar),
    receivablesAging: new ReceivablesAgingReport(readModel, calendar),
    customerStatement: new CustomerStatementReport(readModel, calendar),
    salesByCustomer: new SalesByCustomerReport(readModel),
    inventoryValuation: new InventoryValuationReport(readModel),
  };
}
