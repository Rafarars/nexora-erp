import { can } from '@/modules/access/domain/session';
import { formatMoney, formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableInventoryError } from '@/modules/inventory/domain/inventory-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function StockPage({ searchParams }: { searchParams: Promise<{ bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'inventory.stock.search')) {
    return (
      <p className="text-muted text-sm" data-testid="stock-forbidden">
        Tu rol no tiene permiso para ver las existencias de esta empresa.
      </p>
    );
  }

  const { bodega } = await searchParams;
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let stocks;
  try {
    stocks = await inventoryApi().searchStock(token, bodega || undefined);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="stock-error">
        {readableInventoryError(error, 'No se pudieron cargar las existencias.')}
      </p>
    );
  }

  const total = stocks.reduce((sum, stock) => sum + stock.totalValue, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Existencias</h2>
          <p className="text-muted mt-1 text-sm">En la unidad base de cada artículo, valoradas a su costo promedio.</p>
        </div>

        {/* Un formulario GET: el filtro queda en la dirección y se puede compartir. */}
        {warehouses.length > 0 ? (
          <form className="flex items-center gap-2" data-testid="stock-filter">
            <label htmlFor="bodega" className="text-sm">
              Bodega
            </label>
            <select
              id="bodega"
              name="bodega"
              defaultValue={bodega ?? ''}
              data-testid="stock-warehouse"
              className="border-line bg-background rounded-md border px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <button type="submit" data-testid="stock-filter-submit" className="border-line rounded-md border px-2 py-1 text-sm">
              Filtrar
            </button>
          </form>
        ) : null}
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="stock-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 text-right font-medium">Existencia</th>
              <th className="px-4 py-2 text-right font-medium">Costo promedio</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const key = `${stock.item.sku}-${stock.warehouse.name}`;

              return (
                <tr key={key} className="border-line border-t" data-testid={`stock-row-${key}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{stock.item.name}</p>
                    <p className="text-muted font-mono text-xs">{stock.item.sku}</p>
                  </td>
                  <td className="px-4 py-3">{stock.warehouse.name}</td>
                  <td className="px-4 py-3 text-right" data-testid={`stock-quantity-${key}`}>
                    {formatQuantity(stock.quantity)} {stock.item.baseUnit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(stock.averageCost)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(stock.totalValue)}</td>
                </tr>
              );
            })}

            {stocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted px-4 py-6 text-center" data-testid="stock-empty">
                  No hay existencias registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
          {stocks.length > 0 ? (
            <tfoot>
              <tr className="border-line border-t font-medium">
                <td colSpan={4} className="px-4 py-3 text-right">
                  Valor total
                </td>
                <td className="px-4 py-3 text-right" data-testid="stock-total">
                  {formatMoney(total)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
