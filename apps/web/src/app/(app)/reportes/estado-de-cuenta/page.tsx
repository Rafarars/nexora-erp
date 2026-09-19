import { AccessError } from '@/modules/access/domain/access-error';
import { can } from '@/modules/access/domain/session';
import { formatReportAmount } from '@/modules/reports/domain/reports';
import { readableReportsError } from '@/modules/reports/domain/reports-error';
import type { StatementReport } from '@/modules/reports/domain/reports';
import { DownloadLinks } from '@/sections/reports/download-links';
import { ReportPager } from '@/sections/reports/report-pager';
import { ReportTable } from '@/sections/reports/report-table';
import { FormError } from '@/sections/shared/field';
import { reportsApi } from '@/shared/session/reports-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function StatementReportPage({ searchParams }: { searchParams: Promise<{ cliente?: string; desde_fila?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'reports.receivables.search')) {
    return (
      <p className="text-muted text-sm" data-testid="report-statement-forbidden">
        Tu rol no tiene permiso para ver este reporte.
      </p>
    );
  }

  const { cliente, desde_fila } = await searchParams;
  const offset = Number(desde_fila ?? 0);
  // Los clientes a elegir: los que la antiguedad conoce, que son los que deben algo, y el elegido.
  const aging = await reportsApi().aging(token);
  let statement: StatementReport | null = null;
  let error: string | null = null;

  if (cliente) {
    try {
      statement = await reportsApi().statement(token, cliente, Number.isInteger(offset) && offset > 0 ? offset : 0);
    } catch (caught) {
      if (!(caught instanceof AccessError)) throw caught;

      error = readableReportsError(caught, 'No se pudo leer el estado de cuenta.');
    }
  }

  const customers = aging.customers.map((row) => row.customer);

  if (statement && !customers.some((customer) => customer.id === statement.customer.id)) customers.push(statement.customer);

  const amount = (value: number) => formatReportAmount(value, statement?.decimals ?? 2);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Estado de cuenta</h2>
        <p className="text-muted mt-1 text-sm">Para entregarle al cliente: facturas emitidas y cobros confirmados con el saldo tras cada uno.</p>
      </div>

      <form method="get" className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="report-statement-customer" className="text-sm font-medium">
            Cliente con saldo
          </label>
          <select id="report-statement-customer" name="cliente" defaultValue={cliente ?? ''} data-testid="report-statement-customer" className="border-line bg-background w-64 rounded-md border px-3 py-2 text-sm">
            <option value="">Elige un cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" data-testid="report-statement-submit" className="border-line rounded-md border px-3 py-2 text-sm">
          Ver
        </button>
      </form>

      <FormError message={error} testId="report-statement-error" />

      {statement ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm" data-testid="report-statement-summary">
              Al {statement.asOf}: saldo <strong>{amount(statement.balance)}</strong>, vencido <strong>{amount(statement.overdue)}</strong>, en {statement.currency}
            </p>
            <DownloadLinks report="estado-de-cuenta" formats={['pdf']} params={{ cliente: statement.customer.id }} />
          </div>
          <ReportTable
            testId="report-statement"
            rows={statement.movements}
            rowTestId={(_row, index) => `report-statement-${index + 1}`}
            empty="Este cliente no tiene facturas ni cobros."
            columns={[
              { header: 'Fecha', cell: (row) => row.date },
              { header: 'Documento', cell: (row) => `${row.type === 'invoice' ? 'Factura' : 'Cobro'} ${row.code}` },
              { header: 'Cargo', numeric: true, cell: (row) => (row.debit ? amount(row.debit) : '—') },
              { header: 'Abono', numeric: true, cell: (row) => (row.credit ? amount(row.credit) : '—') },
              { header: 'Saldo', numeric: true, cell: (row) => amount(row.balance) },
            ]}
          />
          <ReportPager page={statement.page} params={{ cliente }} testId="report-statement" />
        </>
      ) : null}
    </section>
  );
}
