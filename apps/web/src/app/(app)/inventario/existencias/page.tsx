import Link from 'next/link';
import { can } from '@/modules/access/domain/session';
import { formatMoney, formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableInventoryError } from '@/modules/inventory/domain/inventory-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  bodega?: string;
  agotadas?: string;
  pagina?: string;
}

export default async function StockPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'inventory.stock.search')) {
    return (
      <p className="text-muted text-sm" data-testid="stock-forbidden">
        Tu rol no tiene permiso para ver las existencias de esta empresa.
      </p>
    );
  }

  const { q, bodega, agotadas, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const includeEmpty = agotadas === '1';
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let stock;
  try {
    stock = await inventoryApi().searchStock(token, {
      q,
      warehouseId: bodega || undefined,
      includeEmpty,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="stock-error">
        {readableInventoryError(error, 'No se pudieron cargar las existencias.')}
      </p>
    );
  }

  const { stocks } = stock;
  const from = stock.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + stocks.length;
  const hrefFor = (next: number) =>
    `/inventario/existencias?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(bodega ? { bodega } : {}),
      ...(includeEmpty ? { agotadas: '1' } : {}),
      ...(next > 1 ? { pagina: String(next) } : {}),
    }).toString()}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Existencias</h2>
          <p className="text-muted mt-1 text-sm">
            En la unidad base de cada artículo, valoradas a su costo promedio en {stock.currency}. Lo que se puede prometer es lo que hay
            menos lo que los pedidos confirmados ya comprometieron.
          </p>
        </div>
      </div>

      {/* Un formulario GET: los filtros quedan en la dirección y se pueden compartir. */}
      <form className="border-line flex flex-wrap items-end gap-3 rounded-lg border p-3" data-testid="stock-filter">
        <div className="space-y-1.5">
          <label htmlFor="stock-search" className="block text-sm font-medium">
            Buscar
          </label>
          <input
            id="stock-search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="SKU o nombre"
            data-testid="stock-search"
            className="border-line bg-background w-56 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {warehouses.length > 0 ? (
          <div className="space-y-1.5">
            <label htmlFor="bodega" className="block text-sm font-medium">
              Bodega
            </label>
            <select
              id="bodega"
              name="bodega"
              defaultValue={bodega ?? ''}
              data-testid="stock-warehouse"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" name="agotadas" value="1" defaultChecked={includeEmpty} data-testid="stock-include-empty" />
          Ver también las agotadas
        </label>

        <button type="submit" data-testid="stock-filter-submit" className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm">
          Filtrar
        </button>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted" data-testid="stock-page-range">
            {from}–{to} de {stock.total}
          </span>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} data-testid="stock-page-previous" className="border-line hover:bg-surface rounded-md border px-3 py-2">
              Anterior
            </Link>
          ) : null}
          {stock.hasMore ? (
            <Link href={hrefFor(page + 1)} data-testid="stock-page-next" className="border-line hover:bg-surface rounded-md border px-3 py-2">
              Siguiente
            </Link>
          ) : null}
        </div>
      </form>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="stock-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 text-right font-medium">Existencia</th>
              <th className="px-4 py-2 text-right font-medium">Reservado</th>
              <th className="px-4 py-2 text-right font-medium">Disponible</th>
              <th className="px-4 py-2 text-right font-medium">Costo promedio</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((row) => {
              const key = `${row.item.sku}-${row.warehouse.name}`;

              return (
                <tr key={key} className="border-line border-t" data-testid={`stock-row-${key}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.item.name}</p>
                    <p className="text-muted font-mono text-xs">{row.item.sku}</p>
                  </td>
                  <td className="px-4 py-3">{row.warehouse.name}</td>
                  <td className="px-4 py-3 text-right" data-testid={`stock-quantity-${key}`}>
                    {formatQuantity(row.quantity)} {row.item.baseUnit}
                  </td>
                  <td className="text-muted px-4 py-3 text-right" data-testid={`stock-reserved-${key}`}>
                    {row.reserved === 0 ? '—' : `${formatQuantity(row.reserved)} ${row.item.baseUnit}`}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" data-testid={`stock-available-${key}`}>
                    {formatQuantity(row.available)} {row.item.baseUnit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.averageCost)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.totalValue)}</td>
                </tr>
              );
            })}

            {stocks.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="stock-empty">
                  No hay existencias registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* El total no cabe en una pagina: lo suma el informe, que ademas se exporta. */}
      <p className="text-muted text-sm">
        ¿Cuánto vale todo el inventario?{' '}
        <Link href="/reportes/valuacion-inventario" className="underline" data-testid="stock-valuation-link">
          Valuación del inventario
        </Link>
      </p>
    </section>
  );
}
