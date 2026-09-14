import { can } from '@/modules/access/domain/session';
import { formatCost, formatQuantity } from '@/modules/inventory/domain/inventory';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportTable } from '@/sections/reports/report-table';
import { catalogApi } from '@/shared/session/catalog-api';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function ValuationReportPage({ searchParams }: { searchParams: Promise<{ bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'reports.inventory.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-valuation-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const { bodega } = await searchParams;
  const [report, warehouses] = await Promise.all([reportsApi().valuation(token, bodega || undefined), can(session, 'catalog.warehouses.search') ? catalogApi().searchWarehouses(token) : []]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Valuación del inventario</h2>
          <p className="text-muted mt-1 text-sm">Existencia de hoy al costo promedio de cada artículo en cada bodega.</p>
        </div>
        <DownloadLinks report="valuacion-inventario" params={{ bodega }} />
      </div>

      {warehouses.length > 0 ? (
        <form method="get" className="flex items-end gap-2">
          <div className="space-y-1.5">
            <label htmlFor="report-valuation-warehouse" className="text-sm font-medium">
              Bodega
            </label>
            <select id="report-valuation-warehouse" name="bodega" defaultValue={bodega ?? ''} data-testid="report-valuation-warehouse" className="border-line bg-background w-56 rounded-md border px-3 py-2 text-sm">
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" data-testid="report-valuation-submit" className="border-line rounded-md border px-3 py-2 text-sm">
            Ver
          </button>
        </form>
      ) : null}

      <ReportTable
        testId="report-valuation"
        rows={report.rows}
        rowTestId={(row) => `report-valuation-${row.item.sku}-${row.warehouse.name}`}
        empty="No hay existencias."
        columns={[
          { header: 'Bodega', cell: (row) => row.warehouse.name },
          { header: 'Artículo', cell: (row) => `${row.item.sku} — ${row.item.name}` },
          { header: 'Existencia', numeric: true, cell: (row) => `${formatQuantity(row.quantity)} ${row.baseUnit}` },
          { header: 'Costo promedio', numeric: true, cell: (row) => formatCost(row.averageCost) },
          { header: 'Valor', numeric: true, cell: (row) => formatAmount(row.value) },
        ]}
        totals={['Total', '', '', '', formatAmount(report.totalValue)]}
      />
    </section>
  );
}
