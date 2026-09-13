import { can } from '@/modules/access/domain/session';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { readablePurchasingError } from '@/modules/purchasing/domain/purchasing-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { purchasingApi } from '@/shared/session/purchasing-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function IncomingPage({ searchParams }: { searchParams: Promise<{ bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'purchasing.incoming.search')) {
    return (
      <p className="text-muted text-sm" data-testid="incoming-forbidden">
        Tu rol no tiene permiso para ver la mercancía en camino de esta empresa.
      </p>
    );
  }

  const { bodega } = await searchParams;
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let incoming;
  try {
    incoming = await purchasingApi().searchIncoming(token, bodega || undefined);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="incoming-error">
        {readablePurchasingError(error, 'No se pudo cargar la mercancía en camino.')}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">En camino</h2>
          <p className="text-muted mt-1 text-sm">
            Lo pedido en órdenes confirmadas que todavía no llegó, en la unidad base de cada artículo.
          </p>
        </div>

        {warehouses.length > 0 ? (
          <form className="flex items-center gap-2" data-testid="incoming-filter">
            <label htmlFor="bodega" className="text-sm">
              Bodega
            </label>
            <select
              id="bodega"
              name="bodega"
              defaultValue={bodega ?? ''}
              data-testid="incoming-warehouse"
              className="border-line bg-background rounded-md border px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <button type="submit" data-testid="incoming-filter-submit" className="border-line rounded-md border px-2 py-1 text-sm">
              Filtrar
            </button>
          </form>
        ) : null}
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
            {incoming.map((row) => {
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
                        {order.expectedDate ? <span className="text-muted"> · llega {order.expectedDate}</span> : null}
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}

            {incoming.length === 0 ? (
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
