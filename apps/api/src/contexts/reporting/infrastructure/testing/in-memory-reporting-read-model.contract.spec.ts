import { ReportCustomer, ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { describeReportingReadModelContract } from '../../testing/reporting-read-model.contract.js';
import { ReportingReadModelHarness, SeedInvoice, SeedPayment, SeedReceipt } from '../../testing/reporting-read-model.harness.js';
import { InMemoryReportingReadModel } from './in-memory-reporting-read-model.js';

type Row<T> = T & { tenantId: string };

// Guarda las filas en su forma original y arma el doble al pedirlo, resumiendo como la base.
class InMemoryReportingHarness implements ReportingReadModelHarness {
  private companies = new Map<string, string>();
  private customers: Row<ReportCustomer>[] = [];
  private warehouses: Row<{ id: string; name: string }>[] = [];
  private items: Row<{ id: string; sku: string; name: string; baseUnit: string }>[] = [];
  private invoices: Row<SeedInvoice>[] = [];
  private payments: Row<SeedPayment>[] = [];
  private receipts: Row<SeedReceipt>[] = [];
  private stocks: Row<{ itemId: string; warehouseId: string; quantity: number; averageCost: number }>[] = [];

  readModel(): ReportingReadModel {
    const model = new InMemoryReportingReadModel();
    const cents = (value: number) => Math.round(value * 100);

    model.companyName = async (tenantId) => this.companies.get(tenantId.value) ?? '';

    for (const { tenantId, ...customer } of this.customers) model.customer(tenantId, customer);

    for (const { tenantId, lines, status, ...invoice } of this.invoices.filter((row) => row.status === 'issued')) {
      const paid = this.payments
        .filter((payment) => payment.tenantId === tenantId && payment.status === 'confirmed')
        .flatMap((payment) => payment.allocations)
        .filter((allocation) => allocation.invoiceId === invoice.id)
        .reduce((sum, allocation) => sum + cents(allocation.amount), 0);

      void status;
      model.invoice(tenantId, {
        ...invoice,
        paid: paid / 100,
        lines: lines.map((line) => {
          const item = this.items.find((candidate) => candidate.id === line.itemId)!;

          return { itemId: line.itemId, sku: item.sku, name: item.name, subtotal: line.subtotal };
        }),
      });
    }

    for (const payment of this.payments.filter((row) => row.status === 'confirmed')) {
      model.payment(payment.tenantId, { code: payment.code, customerId: payment.customerId, date: payment.date, amount: payment.allocations.reduce((sum, a) => sum + cents(a.amount), 0) / 100 });
    }

    for (const receipt of this.receipts.filter((row) => row.status === 'confirmed')) {
      model.receipt(receipt.tenantId, { date: receipt.date, amount: receipt.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unitCost * 100), 0) / 100 });
    }

    for (const warehouse of this.warehouses) model.warehouse(warehouse.tenantId, warehouse.id);

    for (const stock of this.stocks) {
      const item = this.items.find((candidate) => candidate.id === stock.itemId)!;
      const warehouse = this.warehouses.find((candidate) => candidate.id === stock.warehouseId)!;

      model.stockRow(stock.tenantId, { ...stock, warehouseName: warehouse.name, sku: item.sku, name: item.name, baseUnit: item.baseUnit });
    }

    return model;
  }

  async company(tenantId: string, name: string): Promise<void> {
    this.companies.set(tenantId, name);
  }

  async customer(tenantId: string, customer: ReportCustomer): Promise<void> {
    this.customers.push({ ...customer, tenantId });
  }

  async warehouse(tenantId: string, warehouse: { id: string; name: string }): Promise<void> {
    this.warehouses.push({ ...warehouse, tenantId });
  }

  async item(tenantId: string, item: { id: string; sku: string; name: string; baseUnit: string }): Promise<void> {
    this.items.push({ ...item, tenantId });
  }

  async invoice(tenantId: string, invoice: SeedInvoice): Promise<void> {
    this.invoices.push({ ...invoice, tenantId });
  }

  async payment(tenantId: string, payment: SeedPayment): Promise<void> {
    this.payments.push({ ...payment, tenantId });
  }

  async receipt(tenantId: string, receipt: SeedReceipt): Promise<void> {
    this.receipts.push({ ...receipt, tenantId });
  }

  async stock(tenantId: string, stock: { itemId: string; warehouseId: string; quantity: number; averageCost: number }): Promise<void> {
    this.stocks.push({ ...stock, tenantId });
  }

  async reset(): Promise<void> {
    this.companies = new Map();
    this.customers = [];
    this.warehouses = [];
    this.items = [];
    this.invoices = [];
    this.payments = [];
    this.receipts = [];
    this.stocks = [];
  }

  async close(): Promise<void> {}
}

describeReportingReadModelContract('in memory', () => new InMemoryReportingHarness());
