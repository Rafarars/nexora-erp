import { can } from '@/modules/access/domain/session';
import { formatReportAmount } from '@/modules/reports/domain/reports';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportPager } from '@/sections/reports/report-pager';
import { ReportTable } from '@/sections/reports/report-table';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function TrialBalanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; desde_fila?: string }>;
}) {
  const { session, token } = await requireSession();

  if (!can(session, 'accounting.entries.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-trial-balance-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const { desde, hasta, desde_fila } = await searchParams;
  const offset = Number(desde_fila ?? 0);
  const report = await reportsApi().trialBalance(
    token,
    desde || undefined,
    hasta || undefined,
    Number.isInteger(offset) && offset > 0 ? offset : 0,
  );

  const amount = (value: number) => formatReportAmount(value, report.decimals);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Balanza de comprobación</h2>
          <p className="text-muted mt-1 text-sm">
            Movimientos y saldos acumulados por cuenta. La suma del debe iguala al haber. Importes en {report.currency}.
          </p>
        </div>
        <DownloadLinks report="balanza-comprobacion" params={{ desde, hasta }} />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="report-trial-balance-from" className="text-sm font-medium">
            Desde
          </label>
          <input
            id="report-trial-balance-from"
            name="desde"
            type="date"
            defaultValue={desde ?? ''}
            data-testid="report-trial-balance-from"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="report-trial-balance-to" className="text-sm font-medium">
            Hasta
          </label>
          <input
            id="report-trial-balance-to"
            name="hasta"
            type="date"
            defaultValue={hasta ?? ''}
            data-testid="report-trial-balance-to"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          data-testid="report-trial-balance-submit"
          className="border-line rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Filtrar
        </button>
      </form>

      {report.totals.isBalanced ? (
        <div
          data-testid="report-trial-balance-balanced"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          ✓ Balanza cuadrada: total debe {amount(report.totals.debit)} igual a total haber {amount(report.totals.credit)}.
        </div>
      ) : (
        <div
          data-testid="report-trial-balance-unbalanced"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800"
        >
          ⚠ Balanza descuadrada: diferencia de {amount(report.totals.difference)}.
        </div>
      )}

      <ReportTable
        testId="report-trial-balance"
        rows={report.rows}
        rowTestId={(row) => `report-trial-balance-${row.account.code}`}
        empty="No hay movimientos contables registrados."
        columns={[
          { header: 'Cuenta', cell: (row) => row.account.code },
          { header: 'Nombre', cell: (row) => row.account.name },
          { header: 'Debe', numeric: true, cell: (row) => amount(row.debit) },
          { header: 'Haber', numeric: true, cell: (row) => amount(row.credit) },
          { header: 'Saldo', numeric: true, cell: (row) => amount(row.balance) },
        ]}
        totals={[
          'Total',
          report.totals.isBalanced ? 'Cuadrado' : 'Descuadre',
          amount(report.totals.debit),
          amount(report.totals.credit),
          '',
        ]}
      />

      <ReportPager testId="report-trial-balance" page={report.page} params={{ desde, hasta }} />
    </section>
  );
}
