import { ReportPeriod } from '../../domain/period/report-period.js';
import {
  ReportCustomer,
  ReportCustomerSales,
  ReportInvoice,
  ReportItemSales,
  ReportStatementEntry,
  ReportStock,
  ReportingReadModel,
} from '../../domain/read-model/reporting-read-model.js';
import { sumCents } from '../../domain/shared/money.js';

type Tenant<T> = T & { tenantId: string };

export interface InMemoryInvoice extends ReportInvoice {
  subtotal: number;
  tax: number;
  lines: { itemId: string; sku: string; name: string; subtotal: number }[];
}

// Lo que en la base escriben ventas, compras, cobranza e inventario, ya resumido: las pruebas de
// aplicacion siembran filas y el doble responde como las consultas SQL.
export class InMemoryReportingReadModel implements ReportingReadModel {
  private readonly customerRows: Tenant<ReportCustomer>[] = [];
  private readonly invoiceRows: Tenant<InMemoryInvoice>[] = [];
  private readonly paymentRows: Tenant<{ code: string; customerId: string; date: string; amount: number }>[] = [];
  private readonly receiptRows: Tenant<{ date: string; amount: number }>[] = [];
  private readonly stockRows: Tenant<ReportStock>[] = [];
  private readonly warehouseRows: Tenant<{ id: string }>[] = [];

  async companyName(tenantId: { value: string }): Promise<string> {
    return `Empresa ${tenantId.value.slice(0, 4)}`;
  }

  customer(tenantId: string, row: ReportCustomer): void {
    this.customerRows.push({ ...row, tenantId });
  }

  invoice(tenantId: string, row: InMemoryInvoice): void {
    this.invoiceRows.push({ ...row, tenantId });
  }

  payment(tenantId: string, row: { code: string; customerId: string; date: string; amount: number }): void {
    this.paymentRows.push({ ...row, tenantId });
  }

  receipt(tenantId: string, row: { date: string; amount: number }): void {
    this.receiptRows.push({ ...row, tenantId });
  }

  warehouse(tenantId: string, id: string): void {
    if (!this.warehouseRows.some((row) => row.id === id)) this.warehouseRows.push({ id, tenantId });
  }

  stockRow(tenantId: string, row: ReportStock): void {
    this.stockRows.push({ ...row, tenantId });
    this.warehouse(tenantId, row.warehouseId);
  }

  async customers(tenantId: { value: string }): Promise<ReportCustomer[]> {
    return this.of(this.customerRows, tenantId.value).sort((a, b) => a.name.localeCompare(b.name));
  }

  async warehouseExists(tenantId: { value: string }, warehouseId: string): Promise<boolean> {
    return this.warehouseRows.some((row) => row.tenantId === tenantId.value && row.id === warehouseId);
  }

  async issuedInvoices(tenantId: { value: string }, customerId?: string): Promise<ReportInvoice[]> {
    return this.of(this.invoiceRows, tenantId.value)
      .filter((row) => !customerId || row.customerId === customerId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(({ id, code, customerId: customer, issueDate, dueDate, total, paid }) => ({ id, code, customerId: customer, issueDate, dueDate, total, paid }));
  }

  async statementEntries(tenantId: { value: string }, customerId: string): Promise<ReportStatementEntry[]> {
    return [
      ...this.of(this.invoiceRows, tenantId.value)
        .filter((row) => row.customerId === customerId)
        .map((row) => ({ date: row.issueDate, type: 'invoice' as const, code: row.code, amount: row.total })),
      ...this.of(this.paymentRows, tenantId.value)
        .filter((row) => row.customerId === customerId)
        .map((row) => ({ date: row.date, type: 'payment' as const, code: row.code, amount: row.amount })),
    ];
  }

  async salesTotal(tenantId: { value: string }, period: ReportPeriod): Promise<number> {
    return sumCents(this.invoicesIn(tenantId.value, period).map((row) => row.total));
  }

  async purchasesTotal(tenantId: { value: string }, period: ReportPeriod): Promise<number> {
    return sumCents(this.of(this.receiptRows, tenantId.value).filter((row) => within(row.date, period)).map((row) => row.amount));
  }

  async collectedTotal(tenantId: { value: string }, period: ReportPeriod): Promise<number> {
    return sumCents(this.of(this.paymentRows, tenantId.value).filter((row) => within(row.date, period)).map((row) => row.amount));
  }

  async salesByCustomer(tenantId: { value: string }, period: ReportPeriod): Promise<ReportCustomerSales[]> {
    const grouped = new Map<string, InMemoryInvoice[]>();

    for (const row of this.invoicesIn(tenantId.value, period)) grouped.set(row.customerId, [...(grouped.get(row.customerId) ?? []), row]);

    return [...grouped.entries()].map(([customerId, rows]) => ({
      customerId,
      invoices: rows.length,
      subtotal: sumCents(rows.map((row) => row.subtotal)),
      tax: sumCents(rows.map((row) => row.tax)),
      total: sumCents(rows.map((row) => row.total)),
    }));
  }

  async salesByItem(tenantId: { value: string }, period: ReportPeriod): Promise<ReportItemSales[]> {
    const grouped = new Map<string, ReportItemSales & { amounts: number[] }>();

    for (const line of this.invoicesIn(tenantId.value, period).flatMap((row) => row.lines)) {
      const current = grouped.get(line.itemId) ?? { itemId: line.itemId, sku: line.sku, name: line.name, subtotal: 0, amounts: [] };

      current.amounts.push(line.subtotal);
      grouped.set(line.itemId, current);
    }

    return [...grouped.values()].map(({ amounts, ...row }) => ({ ...row, subtotal: sumCents(amounts) }));
  }

  async stock(tenantId: { value: string }, warehouseId?: string): Promise<ReportStock[]> {
    return this.of(this.stockRows, tenantId.value).filter((row) => row.quantity !== 0 && (!warehouseId || row.warehouseId === warehouseId));
  }

  private invoicesIn(tenantId: string, period: ReportPeriod): InMemoryInvoice[] {
    return this.of(this.invoiceRows, tenantId).filter((row) => within(row.issueDate, period));
  }

  private of<T>(rows: Tenant<T>[], tenantId: string): T[] {
    return rows.filter((row) => row.tenantId === tenantId).map(({ tenantId: _tenant, ...row }) => ({ ...row }) as T);
  }
}

const within = (date: string, period: ReportPeriod) => date >= period.from.value && date <= period.to.value;
