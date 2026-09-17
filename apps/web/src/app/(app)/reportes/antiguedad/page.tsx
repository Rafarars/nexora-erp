import { can } from '@/modules/access/domain/session';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { AGING_COLUMNS } from '@/modules/receivables/domain/receivables';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportTable } from '@/sections/reports/report-table';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function AgingReportPage() {
  const { session, token } = await requireSession();

  if (!can(session, 'reports.receivables.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-aging-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const report = await reportsApi().aging(token);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Antigüedad de saldos por cobrar</h2>
          <p className="text-muted mt-1 text-sm">
            Al {report.asOf}. Solo los clientes que deben algo. Importes en {report.currency}.
          </p>
        </div>
        <DownloadLinks report="antiguedad" />
      </div>

      <ReportTable
        testId="report-aging"
        rows={report.customers}
        rowTestId={(row) => `report-aging-${row.customer.code}`}
        empty="Ningún cliente debe nada."
        columns={[
          { header: 'Cliente', cell: (row) => row.customer.name },
          ...AGING_COLUMNS.map((column) => ({ header: column.label, numeric: true, cell: (row: (typeof report.customers)[number]) => formatAmount(row.aging[column.bucket]) })),
          { header: 'Saldo', numeric: true, cell: (row) => formatAmount(row.aging.total) },
        ]}
        totals={['Total', ...AGING_COLUMNS.map((column) => formatAmount(report.totals[column.bucket])), formatAmount(report.totals.total)]}
      />
    </section>
  );
}
