import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { COLLECTION_STATUS_LABELS, overdueLabel } from '@/modules/receivables/domain/receivables';
import type { CollectionStatus, CustomerBalance, Receivable } from '@/modules/receivables/domain/receivables';
import { Filter, Pager } from '@/sections/shared/filters';

export interface ReceivableSearch {
  q: string;
  customerId: string;
  status: string;
  from: string;
  to: string;
  onlyOverdue: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Una anulada no se cobra y no se lista, asi que tampoco se puede filtrar por ella.
const COLLECTABLE: Exclude<CollectionStatus, 'cancelled'>[] = ['pending', 'partially_paid', 'paid'];

// Las facturas vistas desde la cobranza, las que vencen antes primero.
export function ReceivablesTable({
  receivables,
  search,
  customers,
  baseCurrency,
}: {
  receivables: Receivable[];
  search: ReceivableSearch;
  customers: CustomerBalance['customer'][];
  baseCurrency: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Facturas por cobrar</h2>
        <p className="text-muted mt-1 text-sm">
          Lo que debe cada factura emitida. Vencida es la que pasó su fecha y todavía debe algo; mientras un cliente tenga una, no se le factura a crédito.
        </p>
      </div>

      <ReceivableFilters search={search} customers={customers} count={receivables.length} />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="receivables-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Factura</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Vence</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Cobrado</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((row) => (
              <tr key={row.id} className="border-line border-t align-top" data-testid={`receivable-row-${row.code}`}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{row.code}</p>
                  <p className="text-muted text-xs">{row.issueDate}</p>
                </td>
                <td className="px-4 py-3">{row.customer.name}</td>
                <td className="px-4 py-3">
                  <p>{row.dueDate}</p>
                  <p className={`text-xs ${row.daysOverdue > 0 ? 'text-red-600' : 'text-muted'}`} data-testid={`receivable-overdue-${row.code}`}>
                    {row.balance > 0 ? overdueLabel(row.daysOverdue) : '—'}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.currency} {formatAmount(row.total)}
                </td>
                <td className="px-4 py-3 text-right" data-testid={`receivable-paid-${row.code}`}>
                  {formatAmount(row.paid)}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium" data-testid={`receivable-balance-${row.code}`}>
                    {formatAmount(row.balance)}
                  </p>
                  {/* Lo que se suma en saldos y credito: la moneda de la empresa, con las tasas de la factura. */}
                  {row.currency !== baseCurrency ? (
                    <p className="text-muted text-xs" data-testid={`receivable-company-balance-${row.code}`}>
                      {baseCurrency} {formatAmount(row.companyBalance)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3" data-testid={`receivable-status-${row.code}`}>
                  {COLLECTION_STATUS_LABELS[row.status]}
                </td>
              </tr>
            ))}

            {receivables.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="receivables-empty">
                  Ninguna factura coincide con lo que buscas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceivableFilters({
  search,
  customers,
  count,
}: {
  search: ReceivableSearch;
  customers: CustomerBalance['customer'][];
  count: number;
}) {
  const pageHref = (page: number) =>
    `/cuentas-por-cobrar/facturas?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.customerId ? { cliente: search.customerId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(search.onlyOverdue ? { vencidas: 'true' } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="receivable-filter">
        <Filter label="Buscar" htmlFor="receivable-search">
          <input
            id="receivable-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código de la factura o cliente"
            data-testid="receivable-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {customers.length > 0 ? (
          <Filter label="Cliente" htmlFor="receivable-filter-customer">
            <select
              id="receivable-filter-customer"
              name="cliente"
              defaultValue={search.customerId}
              data-testid="receivable-filter-customer"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Filter>
        ) : null}

        <Filter label="Estado" htmlFor="receivable-filter-status">
          <select
            id="receivable-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="receivable-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {COLLECTABLE.map((status) => (
              <option key={status} value={status}>
                {COLLECTION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Filter>

        <Filter label="Vence desde" htmlFor="receivable-filter-from">
          <input
            id="receivable-filter-from"
            name="desde"
            type="date"
            defaultValue={search.from}
            data-testid="receivable-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Vence hasta" htmlFor="receivable-filter-to">
          <input
            id="receivable-filter-to"
            name="hasta"
            type="date"
            defaultValue={search.to}
            data-testid="receivable-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Vencimiento" htmlFor="receivable-filter-overdue">
          <select
            id="receivable-filter-overdue"
            name="vencidas"
            defaultValue={search.onlyOverdue ? 'true' : ''}
            data-testid="receivable-filter-overdue"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="true">Sólo vencidas</option>
          </select>
        </Filter>

        <button
          type="submit"
          data-testid="receivable-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="receivable"
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
