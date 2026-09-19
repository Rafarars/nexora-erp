import { can } from '@/modules/access/domain/session';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { Filter, Pager } from '@/sections/shared/filters';
import { catalogApi } from '@/shared/session/catalog-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  bodega?: string;
  pagina?: string;
}

export default async function IncomingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.incoming.search')) {
    return (
      <p className="text-muted text-sm" data-testid="incoming-forbidden">
        Tu rol no tiene permiso para ver la mercancía en camino de esta empresa.
      </p>
    );
  }

  const { q, bodega, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let incoming;
  try {
    incoming = await purchasingApi().searchIncoming(token, {
      q,
      warehouseId: bodega,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="incoming-error">
        {readablePurchasingError(error, 'No se pudo cargar la mercancía en camino.')}
      </p>
    );
  }

  const rows = incoming.incoming;
  const pageHref = (next: number) =>
    `/compras/en-camino?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(bodega ? { bodega } : {}),
      ...(next > 1 ? { pagina: String(next) } : {}),
    }).toString()}`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">En camino</h2>
        <p className="text-muted mt-1 text-sm">
          Lo pedido en órdenes confirmadas que todavía no llegó, en la unidad base de cada artículo.
        </p>
      </div>

      <div className="border-line space-y-3 rounded-lg border p-3">
        {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
        <form method="get" className="flex flex-wrap items-end gap-2" data-testid="incoming-filter">
          <Filter label="Buscar" htmlFor="incoming-search">
            <input
              id="incoming-search"
              name="q"
              defaultValue={q ?? ''}
              placeholder="SKU o nombre"
              data-testid="incoming-search"
              className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
            />
          </Filter>

          {warehouses.length > 0 ? (
            <Filter label="Bodega" htmlFor="incoming-filter-warehouse">
              <select
                id="incoming-filter-warehouse"
                name="bodega"
                defaultValue={bodega ?? ''}
                data-testid="incoming-warehouse"
                className="border-line bg-background rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </Filter>
          ) : null}

          <button
            type="submit"
            data-testid="incoming-filter-submit"
            className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
          >
            Filtrar
          </button>
        </form>

        <Pager
          testId="incoming"
          page={page}
          pageSize={PAGE_SIZE}
          count={rows.length}
          total={incoming.total}
          hasMore={incoming.hasMore}
          href={pageHref}
        />
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="incoming-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 text-right font-medium">En camino</th>
              <th className="px-4 py-2 font-medium">Órdenes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = `${row.item.sku}-${row.warehouse.name}`;

              return (
                <tr key={key} className="border-line border-t align-top" data-testid={`incoming-row-${key}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.item.name}</p>
                    <p className="text-muted font-mono text-xs">{row.item.sku}</p>
                  </td>
                  <td className="px-4 py-3">{row.warehouse.name}</td>
                  <td className="px-4 py-3 text-right" data-testid={`incoming-quantity-${key}`}>
                    {formatQuantity(row.quantity)} {row.item.baseUnit}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.orders.map((order) => (
                      <p key={order.id}>
                        <span className="font-mono">{order.code}</span>: {formatQuantity(order.pendingQuantity)} {row.item.baseUnit}
                        {order.expectedDate ? (
                          <span
                            className={order.late ? 'text-red-500' : 'text-muted'}
                            data-testid={`incoming-expected-${key}-${order.code}`}
                          >
                            {' '}
                            · {order.late ? 'atrasada, llegaba' : 'llega'} {order.expectedDate}
                          </span>
                        ) : null}
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted px-4 py-6 text-center" data-testid="incoming-empty">
                  No hay mercancía en camino.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
