import { can } from '@/modules/access/domain/session';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableInventoryError } from '@/modules/inventory/domain/inventory-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function LowStockPage({ searchParams }: { searchParams: Promise<{ bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'inventory.stock.search')) {
    return (
      <p className="text-muted text-sm" data-testid="low-stock-forbidden">
        Tu rol no tiene permiso para ver las existencias de esta empresa.
      </p>
    );
  }

  const { bodega } = await searchParams;
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let rows;
  try {
    rows = await inventoryApi().searchLowStock(token, bodega || undefined);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="low-stock-error">
        {readableInventoryError(error, 'No se pudo cargar lo que hay que reponer.')}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Bajo mínimo</h2>
          <p className="text-muted mt-1 text-sm">
            Artículos cuya existencia <strong>proyectada</strong> —lo que hay, menos lo que los pedidos
            confirmados reservaron, más lo que las órdenes de compra traen en camino— queda por debajo del mínimo
            de esa bodega. El mínimo se pone en el artículo.
          </p>
        </div>

        {warehouses.length > 0 ? (
          <form className="flex items-center gap-2" data-testid="low-stock-filter">
            <label htmlFor="bodega" className="text-sm">
              Bodega
            </label>
            <select
              id="bodega"
              name="bodega"
              defaultValue={bodega ?? ''}
              data-testid="low-stock-warehouse"
              className="border-line bg-background rounded-md border px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <button type="submit" data-testid="low-stock-filter-submit" className="border-line rounded-md border px-2 py-1 text-sm">
              Filtrar
            </button>
          </form>
        ) : null}
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="low-stock-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 text-right font-medium">Existencia</th>
              <th className="px-4 py-2 text-right font-medium">Reservado</th>
              <th className="px-4 py-2 text-right font-medium">En camino</th>
              <th className="px-4 py-2 text-right font-medium">Proyectada</th>
              <th className="px-4 py-2 text-right font-medium">Mínimo</th>
              <th className="px-4 py-2 text-right font-medium">Falta</th>
              <th className="px-4 py-2 text-right font-medium">Pedir</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.item.id}-${row.warehouse.id}`} className="border-line border-t" data-testid={`low-stock-row-${row.item.sku}`}>
                <td className="px-4 py-3">
                  <p>{row.item.name}</p>
                  <p className="text-muted font-mono text-xs">{row.item.sku}</p>
                </td>
                <td className="px-4 py-3">{row.warehouse.name}</td>
                <td className="px-4 py-3 text-right">
                  {formatQuantity(row.quantity)} {row.item.baseUnit}
                </td>
                <td className="px-4 py-3 text-muted text-right" data-testid={`low-stock-reserved-${row.item.sku}`}>
                  {formatQuantity(row.reserved)}
                </td>
                <td className="px-4 py-3 text-muted text-right" data-testid={`low-stock-incoming-${row.item.sku}`}>
                  {formatQuantity(row.incoming)}
                </td>
                <td className="px-4 py-3 text-right font-medium" data-testid={`low-stock-projected-${row.item.sku}`}>
                  {formatQuantity(row.projected)}
                </td>
                <td className="px-4 py-3 text-right">{formatQuantity(row.minQuantity)}</td>
                <td className="px-4 py-3 text-right text-red-600" data-testid={`low-stock-missing-${row.item.sku}`}>
                  {formatQuantity(row.missing)}
                </td>
                <td className="px-4 py-3 text-right font-medium" data-testid={`low-stock-suggested-${row.item.sku}`}>
                  {formatQuantity(row.suggested)}
                </td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted px-4 py-6 text-center" data-testid="low-stock-empty">
                  Ningún artículo está por debajo de su mínimo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
