import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ReportPeriod } from '../../domain/period/report-period.js';
import { ReportingReadModel } from '../../domain/read-model/reporting-read-model.js';
import { centsToNumber, toCents } from '../../domain/shared/money.js';
import { ReportDate } from '../../domain/shared/report-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface DashboardResponse {
  period: { from: string; to: string };
  salesThisMonth: number;
  purchasesThisMonth: number;
  collectedThisMonth: number;
  receivableBalance: number;
  overdueBalance: number;
  inventoryValue: number;
  topDebtors: { customer: { id: string; code: string; name: string }; balance: number; overdue: number }[];
  topItems: { item: { id: string; sku: string; name: string }; subtotal: number }[];
}

const TOP = 5;

// Los indicadores del mes en curso y la foto de hoy. Cada cifra sale de su modulo; aqui solo se
// suma, siempre en centimos.
export class DashboardSearcher {
  constructor(
    private readonly readModel: ReportingReadModel,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string }): Promise<DashboardResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const today = ReportDate.fromDate(this.clock.now());
    const month = ReportPeriod.monthToDate(today);

    const [sales, purchases, collected, invoices, customers, items, stock] = await Promise.all([
      this.readModel.salesTotal(tenantId, month),
      this.readModel.purchasesTotal(tenantId, month),
      this.readModel.collectedTotal(tenantId, month),
      this.readModel.issuedInvoices(tenantId),
      this.readModel.customers(tenantId),
      this.readModel.salesByItem(tenantId, month),
      this.readModel.stock(tenantId),
    ]);

    const debts = new Map<string, { balance: bigint; overdue: bigint }>();

    for (const invoice of invoices) {
      const balance = toCents(invoice.total) - toCents(invoice.paid);

      if (balance <= 0n) continue;

      const current = debts.get(invoice.customerId) ?? { balance: 0n, overdue: 0n };

      current.balance += balance;
      if (invoice.dueDate < today.value) current.overdue += balance;
      debts.set(invoice.customerId, current);
    }

    const totalOf = (pick: (debt: { balance: bigint; overdue: bigint }) => bigint) => centsToNumber([...debts.values()].reduce((sum, debt) => sum + pick(debt), 0n));

    return {
      period: { from: month.from.value, to: month.to.value },
      salesThisMonth: sales,
      purchasesThisMonth: purchases,
      collectedThisMonth: collected,
      receivableBalance: totalOf((debt) => debt.balance),
      overdueBalance: totalOf((debt) => debt.overdue),
      inventoryValue: centsToNumber(stock.reduce((sum, row) => sum + stockValueCents(row.quantity, row.averageCost), 0n)),
      topDebtors: [...debts.entries()]
        .sort(([, a], [, b]) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
        .slice(0, TOP)
        .map(([customerId, debt]) => {
          const customer = customers.find((candidate) => candidate.id === customerId);

          return { customer: { id: customerId, code: customer?.code ?? '', name: customer?.name ?? '' }, balance: centsToNumber(debt.balance), overdue: centsToNumber(debt.overdue) };
        }),
      topItems: [...items]
        .sort((a, b) => b.subtotal - a.subtotal || a.sku.localeCompare(b.sku))
        .slice(0, TOP)
        .map((row) => ({ item: { id: row.itemId, sku: row.sku, name: row.name }, subtotal: row.subtotal })),
    };
  }
}

// Existencia (cuatro decimales) por costo promedio (seis), redondeado a centimos por fila.
export function stockValueCents(quantity: number, averageCost: number): bigint {
  const units = BigInt(Math.round(quantity * 10_000));
  const micros = BigInt(Math.round(averageCost * 1_000_000));

  return (units * micros * 2n + 100_000_000n) / 200_000_000n;
}
