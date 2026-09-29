import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { PAYABLE_STATUS_LABELS, overdueLabel } from '@/modules/payables/domain/payables';
import type { PayableInvoice, PayableStatus, SupplierBalance } from '@/modules/payables/domain/payables';
import { Filter, Pager } from '@/sections/shared/filters';

export interface PayableSearch {
  q: string;
  supplierId: string;
  status: string;
  from: string;
  to: string;
  onlyOverdue: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

const PAYABLE_STATUSES: Exclude<PayableStatus, 'cancelled'>[] = ['pending', 'partially_paid', 'paid'];

export function PayablesTable({
  invoices,
  search,
  suppliers,
  baseCurrency,
}: {
  invoices: PayableInvoice[];
  search: PayableSearch;
  suppliers: SupplierBalance['supplier'][];
  baseCurrency: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Facturas por pagar</h2>
        <p className="text-muted mt-1 text-sm">
          Lo que se le debe a cada proveedor por facturas emitidas. Vencida es la que pasó su fecha de vencimiento y todavía tiene saldo pendiente.
        </p>
      </div>

      <PayableFilters search={search} suppliers={suppliers} count={invoices.length} />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="payables-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Factura</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Vence</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Pagado</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((row) => (
              <tr key={row.id} className="border-line border-t align-top" data-testid={`payable-row-${row.code}`}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{row.code}</p>
                  <p className="text-muted text-xs">{row.issueDate}</p>
                </td>
                <td className="px-4 py-3">{row.supplier.name}</td>
                <td className="px-4 py-3">
                  <p>{row.dueDate}</p>
                  <p className={`text-xs ${row.daysOverdue > 0 ? 'text-red-600' : 'text-muted'}`} data-testid={`payable-overdue-${row.code}`}>
                    {row.balance > 0 ? overdueLabel(row.daysOverdue) : '—'}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.currency} {formatAmount(row.total)}
                </td>
                <td className="px-4 py-3 text-right" data-testid={`payable-paid-${row.code}`}>
                  {formatAmount(row.paid)}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-medium" data-testid={`payable-balance-${row.code}`}>
                    {formatAmount(row.balance)}
                  </p>
                  {row.currency !== baseCurrency ? (
                    <p className="text-muted text-xs" data-testid={`payable-company-balance-${row.code}`}>
                      {baseCurrency} {formatAmount(row.companyBalance)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3" data-testid={`payable-status-${row.code}`}>
                  {PAYABLE_STATUS_LABELS[row.status]}
                </td>
              </tr>
            ))}

            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="payables-empty">
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

function PayableFilters({
  search,
  suppliers,
  count,
}: {
  search: PayableSearch;
  suppliers: SupplierBalance['supplier'][];
  count: number;
}) {
  const pageHref = (page: number) =>
    `/cuentas-por-pagar/facturas?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.supplierId ? { proveedor: search.supplierId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(search.onlyOverdue ? { vencidas: 'true' } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="payable-filter">
        <Filter label="Buscar" htmlFor="payable-search">
          <input
            id="payable-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código o número del proveedor"
            data-testid="payable-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {suppliers.length > 0 ? (
          <Filter label="Proveedor" htmlFor="payable-filter-supplier">
            <select
              id="payable-filter-supplier"
              name="proveedor"
              defaultValue={search.supplierId}
              data-testid="payable-filter-supplier"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Filter>
        ) : null}

        <Filter label="Estado" htmlFor="payable-filter-status">
          <select
            id="payable-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="payable-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {PAYABLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYABLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Filter>

        <Filter label="Vence desde" htmlFor="payable-filter-from">
          <input
            id="payable-filter-from"
            name="desde"
            type="date"
            defaultValue={search.from}
            data-testid="payable-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Vence hasta" htmlFor="payable-filter-to">
          <input
            id="payable-filter-to"
            name="hasta"
            type="date"
            defaultValue={search.to}
            data-testid="payable-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            name="vencidas"
            value="true"
            defaultChecked={search.onlyOverdue}
            data-testid="payable-filter-overdue"
            className="rounded border-neutral-300"
          />
          Solo vencidas
        </label>

        <button
          type="submit"
          data-testid="payable-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm font-medium"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="payable"
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
