import Link from 'next/link';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { AGING_COLUMNS } from '@/modules/payables/domain/payables';
import type { AgingTotals, SupplierBalance } from '@/modules/payables/domain/payables';
import { DownloadLinks } from '@/sections/reports/download-links';
import { Filter, Pager } from '@/sections/shared/filters';

export interface AgingSearch {
  q: string;
  onlyWithBalance: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function AgingTable({
  suppliers,
  totals,
  search,
  canReadStatement,
}: {
  suppliers: SupplierBalance[];
  totals: AgingTotals;
  search: AgingSearch;
  canReadStatement: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Antigüedad de saldos</h2>
          <p className="text-muted mt-1 text-sm">
            Lo que se le debe a cada proveedor repartido por tramos de vencimiento.
          </p>
        </div>
        <DownloadLinks report="antiguedad-por-pagar" />
      </div>

      <AgingFilters search={search} count={suppliers.length} />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="aging-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              {AGING_COLUMNS.map((column) => (
                <th key={column.bucket} className="px-4 py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((row) => (
              <tr key={row.supplier.id} className="border-line border-t align-top" data-testid={`aging-row-${row.supplier.code}`}>
                <td className="px-4 py-3">
                  {canReadStatement ? (
                    <Link href={`/cuentas-por-pagar/estado-de-cuenta?proveedor=${row.supplier.id}`} className="font-medium underline-offset-2 hover:underline">
                      {row.supplier.name}
                    </Link>
                  ) : (
                    <p className="font-medium">{row.supplier.name}</p>
                  )}
                  <p className="text-muted font-mono text-xs">{row.supplier.code}</p>
                </td>
                {AGING_COLUMNS.map((column) => (
                  <td key={column.bucket} className="px-4 py-3 text-right" data-testid={`aging-${column.bucket}-${row.supplier.code}`}>
                    {row.aging[column.bucket] > 0 ? formatAmount(row.aging[column.bucket]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-medium" data-testid={`aging-balance-${row.supplier.code}`}>
                  {formatAmount(row.balance)}
                </td>
              </tr>
            ))}

            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="aging-empty">
                  Ningún proveedor coincide con lo que buscas.
                </td>
              </tr>
            ) : (
              <tr className="border-line bg-surface border-t font-medium" data-testid="aging-totals">
                <td className="px-4 py-3">Total del filtro</td>
                {AGING_COLUMNS.map((column) => (
                  <td key={column.bucket} className="px-4 py-3 text-right">
                    {formatAmount(totals[column.bucket])}
                  </td>
                ))}
                <td className="px-4 py-3 text-right" data-testid="aging-totals-balance">
                  {formatAmount(totals.total)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AgingFilters({ search, count }: { search: AgingSearch; count: number }) {
  const pageHref = (page: number) =>
    `/cuentas-por-pagar/antiguedad?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(!search.onlyWithBalance ? { conSaldo: 'false' } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="aging-filter">
        <Filter label="Buscar" htmlFor="aging-search">
          <input
            id="aging-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código o nombre del proveedor"
            data-testid="aging-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            name="conSaldo"
            value="false"
            defaultChecked={!search.onlyWithBalance}
            data-testid="aging-filter-zero-balance"
            className="rounded border-neutral-300"
          />
          Mostrar proveedores con saldo cero
        </label>

        <button
          type="submit"
          data-testid="aging-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm font-medium"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="aging"
        page={search.page}
        pageSize={search.pageSize}
        count={count}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />
    </div>
  );
}
