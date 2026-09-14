import { AccessError } from '@/modules/access/domain/access-error';
import { can } from '@/modules/access/domain/session';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { monthToDate } from '@/modules/reports/domain/reports';
import type { SalesByCustomerReport } from '@/modules/reports/domain/reports';
import { readableReportsError } from '@/modules/reports/domain/reports-error';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportTable } from '@/sections/reports/report-table';
import { FormError } from '@/sections/shared/field';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function SalesByCustomerPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'reports.sales.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-sales-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const month = monthToDate(new Date().toISOString().slice(0, 10));
  const { desde = month.from, hasta = month.to } = await searchParams;
  let report: SalesByCustomerReport | null = null;
  let error: string | null = null;

  try {
    report = await reportsApi().salesByCustomer(token, desde, hasta);
  } catch (caught) {
    if (!(caught instanceof AccessError)) throw caught;

    error = readableReportsError(caught, 'No se pudo leer el reporte.');
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Ventas por cliente</h2>
          <p className="text-muted mt-1 text-sm">Lo facturado en el periodo, sin facturas anuladas. Hasta un año.</p>
        </div>
        {report ? <DownloadLinks report="ventas-por-cliente" params={{ desde, hasta }} /> : null}
      </div>

      <form method="get" className="flex items-end gap-2">
        {[
          ['desde', 'Desde', desde],
          ['hasta', 'Hasta', hasta],
        ].map(([name, label, value]) => (
          <div key={name} className="space-y-1.5">
            <label htmlFor={`report-sales-${name}`} className="text-sm font-medium">
              {label}
            </label>
            <input id={`report-sales-${name}`} name={name} type="date" defaultValue={value} data-testid={`report-sales-${name}`} className="border-line rounded-md border bg-transparent px-3 py-2 text-sm" />
          </div>
        ))}
        <button type="submit" data-testid="report-sales-submit" className="border-line rounded-md border px-3 py-2 text-sm">
          Ver
        </button>
      </form>

      <FormError message={error} testId="report-sales-error" />

      {report ? (
        <ReportTable
          testId="report-sales"
          rows={report.customers}
          rowTestId={(row) => `report-sales-${row.customer.code}`}
          empty="No hay facturas emitidas en ese periodo."
          columns={[
            { header: 'Cliente', cell: (row) => row.customer.name },
            { header: 'Facturas', numeric: true, cell: (row) => row.invoices },
            { header: 'Subtotal', numeric: true, cell: (row) => formatAmount(row.subtotal) },
            { header: 'Impuesto', numeric: true, cell: (row) => formatAmount(row.tax) },
            { header: 'Total', numeric: true, cell: (row) => formatAmount(row.total) },
          ]}
          totals={['Total', report.totals.invoices, formatAmount(report.totals.subtotal), formatAmount(report.totals.tax), formatAmount(report.totals.total)]}
        />
      ) : null}
    </section>
  );
}
