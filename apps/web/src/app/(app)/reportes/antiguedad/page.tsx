import { can } from '@/modules/access/domain/session';
import { formatReportAmount } from '@/modules/reports/domain/reports';
import { AGING_COLUMNS } from '@/modules/receivables/domain/receivables';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportPager } from '@/sections/reports/report-pager';
import { ReportTable } from '@/sections/reports/report-table';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function AgingReportPage({ searchParams }: { searchParams: Promise<{ desde_fila?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'reports.receivables.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-aging-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const offset = Number((await searchParams).desde_fila ?? 0);
  const report = await reportsApi().aging(token, Number.isInteger(offset) && offset > 0 ? offset : 0);
  const amount = (value: number) => formatReportAmount(value, report.decimals);

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
          ...AGING_COLUMNS.map((column) => ({ header: column.label, numeric: true, cell: (row: (typeof report.customers)[number]) => amount(row.aging[column.bucket]) })),
          { header: 'Saldo', numeric: true, cell: (row) => amount(row.aging.total) },
        ]}
        totals={['Total', ...AGING_COLUMNS.map((column) => amount(report.totals[column.bucket])), amount(report.totals.total)]}
      />
      <ReportPager page={report.page} params={{}} testId="report-aging" />
    </section>
  );
}
