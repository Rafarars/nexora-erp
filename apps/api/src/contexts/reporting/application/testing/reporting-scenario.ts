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
  const readModel = new InMemoryReportingReadModel();

  return {
    clock,
    readModel,
    dashboard: new DashboardSearcher(readModel, clock),
    receivablesAging: new ReceivablesAgingReport(readModel, clock),
    customerStatement: new CustomerStatementReport(readModel, clock),
    salesByCustomer: new SalesByCustomerReport(readModel),
    inventoryValuation: new InventoryValuationReport(readModel),
  };
}
