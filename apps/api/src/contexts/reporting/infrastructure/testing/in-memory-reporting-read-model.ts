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
import { DocumentCurrency, DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { amountUnits, sumAmounts, unitsToNumber } from '../../domain/shared/money.js';

type Tenant<T> = T & { tenantId: string };

// Sin monedas, como los documentos anteriores al multimoneda: la del documento es la de la empresa.
const COMPANY_CURRENCY: DocumentCurrencyPrimitives = { currency: 'USD', exchangeRate: null, baseCurrency: 'USD', baseExchangeRate: null, manualExchangeRate: false };

type WithCurrency = Partial<DocumentCurrencyPrimitives>;

export interface InMemoryInvoice extends Omit<ReportInvoice, 'balance'>, WithCurrency {
  subtotal: number;
  tax: number;
  lines: { itemId: string; sku: string; name: string; subtotal: number }[];
}

// En la moneda de la empresa, con las tasas del documento y sus decimales: lo mismo que hace el SQL.
const inCompanyCurrency = (row: WithCurrency, value: number, decimals: number) =>
  unitsToNumber(DocumentCurrency.fromPrimitives({ ...COMPANY_CURRENCY, ...row }).baseAmount(amountUnits(value), decimals));

// Lo que en la base escriben ventas, compras, cobranza e inventario, ya resumido: las pruebas de
// aplicacion siembran filas y el doble responde como las consultas SQL.
export class InMemoryReportingReadModel implements ReportingReadModel {
  private readonly customerRows: Tenant<ReportCustomer>[] = [];
  private readonly invoiceRows: Tenant<InMemoryInvoice>[] = [];
  private readonly paymentRows: Tenant<{ code: string; customerId: string; date: string; amount: number; allocations?: { invoiceId: string; amount: number }[] } & WithCurrency>[] = [];
  private readonly receiptRows: Tenant<{ date: string; amount: number } & WithCurrency>[] = [];
  private readonly stockRows: Tenant<ReportStock>[] = [];
  private readonly warehouseRows: Tenant<{ id: string; name: string }>[] = [];

  async company(tenantId: { value: string }): Promise<{ name: string; fiscalId: string | null }> {
    return { name: `Empresa ${tenantId.value.slice(0, 4)}`, fiscalId: null };
  }

  customer(tenantId: string, row: ReportCustomer): void {
    this.customerRows.push({ ...row, tenantId });
  }

  invoice(tenantId: string, row: InMemoryInvoice): void {
    this.invoiceRows.push({ ...row, tenantId });
  }

  payment(tenantId: string, row: { code: string; customerId: string; date: string; amount: number; allocations?: { invoiceId: string; amount: number }[] } & WithCurrency): void {
    this.paymentRows.push({ ...row, tenantId });
  }

  receipt(tenantId: string, row: { date: string; amount: number } & WithCurrency): void {
    this.receiptRows.push({ ...row, tenantId });
  }

  warehouse(tenantId: string, id: string, name = `Bodega ${id.slice(0, 4)}`): void {
    if (!this.warehouseRows.some((row) => row.id === id)) this.warehouseRows.push({ id, name, tenantId });
  }

  stockRow(tenantId: string, row: ReportStock): void {
    this.stockRows.push({ ...row, tenantId });
    this.warehouse(tenantId, row.warehouseId, row.warehouseName);
  }

  async customers(tenantId: { value: string }): Promise<ReportCustomer[]> {
    return this.of(this.customerRows, tenantId.value).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Sin distinguir mayusculas, como la columna uuid de PostgreSQL: el doble no puede ser mas
  // estricto que la base, o el contrato pasa en verde con los dos comportandose distinto.
  async warehouseNamed(tenantId: { value: string }, warehouseId: string): Promise<string | null> {
    const wanted = warehouseId.toLowerCase();

    return this.warehouseRows.find((row) => row.tenantId === tenantId.value && row.id.toLowerCase() === wanted)?.name ?? null;
  }

  async issuedInvoices(tenantId: { value: string }, decimals: number, customerId?: string): Promise<ReportInvoice[]> {
    return this.of(this.invoiceRows, tenantId.value)
      .filter((row) => !customerId || row.customerId === customerId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((row) => ({
        id: row.id,
        code: row.code,
        customerId: row.customerId,
        issueDate: row.issueDate,
        dueDate: row.dueDate,
        total: inCompanyCurrency(row, row.total, decimals),
        paid: inCompanyCurrency(row, row.paid, decimals),
        balance: inCompanyCurrency(row, row.total - row.paid, decimals),
      }));
  }

  // Un cobro rebaja lo que valia el saldo de cada factura antes menos lo que vale despues; sin sus
  // aplicaciones, se toma su importe tal cual, como los cobros anteriores al multimoneda.
  async statementEntries(tenantId: { value: string }, customerId: string, decimals: number): Promise<ReportStatementEntry[]> {
    const invoices = this.of(this.invoiceRows, tenantId.value).filter((row) => row.customerId === customerId);
    const owed = new Map(invoices.map((row) => [row.id, row.total]));
    const paidOff = (invoiceId: string, amount: number) => {
      const invoice = invoices.find((row) => row.id === invoiceId);
      const before = owed.get(invoiceId) ?? 0;
      const after = before - amount;

      owed.set(invoiceId, after);

      return invoice ? inCompanyCurrency(invoice, before, decimals) - inCompanyCurrency(invoice, after, decimals) : amount;
    };

    return [
      ...invoices.map((row) => ({ date: row.issueDate, type: 'invoice' as const, code: row.code, amount: inCompanyCurrency(row, row.total, decimals) })),
      ...this.of(this.paymentRows, tenantId.value)
        .filter((row) => row.customerId === customerId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code))
        .map((row) => ({
          date: row.date,
          type: 'payment' as const,
          code: row.code,
          amount: row.allocations ? sumAmounts(row.allocations.map((allocation) => paidOff(allocation.invoiceId, allocation.amount))) : inCompanyCurrency(row, row.amount, decimals),
        })),
    ];
  }

  async salesTotal(tenantId: { value: string }, period: ReportPeriod, decimals: number): Promise<number> {
    return sumAmounts(this.invoicesIn(tenantId.value, period).map((row) => inCompanyCurrency(row, row.total, decimals)));
  }

  async purchasesTotal(tenantId: { value: string }, period: ReportPeriod, decimals: number): Promise<number> {
    return sumAmounts(this.of(this.receiptRows, tenantId.value).filter((row) => within(row.date, period)).map((row) => inCompanyCurrency(row, row.amount, decimals)));
  }

  async collectedTotal(tenantId: { value: string }, period: ReportPeriod, decimals: number): Promise<number> {
    return sumAmounts(this.of(this.paymentRows, tenantId.value).filter((row) => within(row.date, period)).map((row) => inCompanyCurrency(row, row.amount, decimals)));
  }

  async salesByCustomer(tenantId: { value: string }, period: ReportPeriod, decimals: number): Promise<ReportCustomerSales[]> {
    const grouped = new Map<string, InMemoryInvoice[]>();

    for (const row of this.invoicesIn(tenantId.value, period)) grouped.set(row.customerId, [...(grouped.get(row.customerId) ?? []), row]);

    return [...grouped.entries()].map(([customerId, rows]) => ({
      customerId,
      invoices: rows.length,
      subtotal: sumAmounts(rows.map((row) => inCompanyCurrency(row, row.subtotal, decimals))),
      tax: sumAmounts(rows.map((row) => inCompanyCurrency(row, row.tax, decimals))),
      total: sumAmounts(rows.map((row) => inCompanyCurrency(row, row.total, decimals))),
    }));
  }

  async salesByItem(tenantId: { value: string }, period: ReportPeriod, decimals: number): Promise<ReportItemSales[]> {
    const grouped = new Map<string, ReportItemSales & { amounts: number[] }>();

    for (const invoice of this.invoicesIn(tenantId.value, period)) {
      for (const line of invoice.lines) {
        const current = grouped.get(line.itemId) ?? { itemId: line.itemId, sku: line.sku, name: line.name, subtotal: 0, amounts: [] };

        current.amounts.push(inCompanyCurrency(invoice, line.subtotal, decimals));
        grouped.set(line.itemId, current);
      }
    }

    return [...grouped.values()].map(({ amounts, ...row }) => ({ ...row, subtotal: sumAmounts(amounts) }));
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
