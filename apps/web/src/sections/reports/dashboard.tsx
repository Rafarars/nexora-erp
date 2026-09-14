import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import type { Dashboard } from '@/modules/reports/domain/reports';

// Los indicadores del mes y la foto de hoy. Cada cifra es la misma que muestra su modulo.
export function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  const indicators = [
    { label: 'Ventas del mes', value: dashboard.salesThisMonth, testId: 'dashboard-sales' },
    { label: 'Compras recibidas del mes', value: dashboard.purchasesThisMonth, testId: 'dashboard-purchases' },
    { label: 'Cobrado en el mes', value: dashboard.collectedThisMonth, testId: 'dashboard-collected' },
    { label: 'Saldo por cobrar', value: dashboard.receivableBalance, testId: 'dashboard-receivable' },
    { label: 'Vencido', value: dashboard.overdueBalance, testId: 'dashboard-overdue' },
    { label: 'Valor del inventario', value: dashboard.inventoryValue, testId: 'dashboard-inventory' },
  ];

  return (
    <section className="space-y-4" data-testid="dashboard">
      <div>
        <h2 className="text-base font-semibold">Tablero</h2>
        <p className="text-muted mt-1 text-sm">
          Del {dashboard.period.from} al {dashboard.period.to}. Ventas, compras y cobros son del mes; saldos e inventario, de hoy. Montos sin impuesto en compras.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        {indicators.map((indicator) => (
          <div key={indicator.testId} className="border-line rounded-lg border p-4">
            <dt className="text-muted text-xs uppercase tracking-wide">{indicator.label}</dt>
            <dd className="mt-1 text-lg font-semibold" data-testid={indicator.testId}>
              {formatAmount(indicator.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <Ranking
          title="Clientes que más deben"
          testId="dashboard-debtors"
          empty="Ningún cliente debe nada."
          rows={dashboard.topDebtors.map((row) => ({ key: row.customer.id, label: row.customer.name, detail: row.overdue > 0 ? `Vencido ${formatAmount(row.overdue)}` : 'Al día', value: row.balance }))}
        />
        <Ranking
          title="Artículos más vendidos del mes"
          testId="dashboard-items"
          empty="Todavía no hay ventas este mes."
          rows={dashboard.topItems.map((row) => ({ key: row.item.id, label: row.item.name, detail: row.item.sku, value: row.subtotal }))}
        />
      </div>
    </section>
  );
}

function Ranking({ title, testId, empty, rows }: { title: string; testId: string; empty: string; rows: { key: string; label: string; detail: string; value: number }[] }) {
  return (
    <div className="border-line rounded-lg border" data-testid={testId}>
      <p className="border-line border-b px-4 py-2 text-sm font-medium">{title}</p>
      {rows.length === 0 ? <p className="text-muted px-4 py-3 text-sm">{empty}</p> : null}
      <ol>
        {rows.map((row, index) => (
          <li key={row.key} className="border-line flex items-center justify-between border-t px-4 py-2 text-sm first:border-t-0" data-testid={`${testId}-${index + 1}`}>
            <span>
              {row.label} <span className="text-muted text-xs">{row.detail}</span>
            </span>
            <span className="font-medium">{formatAmount(row.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
