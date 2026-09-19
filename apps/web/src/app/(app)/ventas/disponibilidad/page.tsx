import { can } from '@/modules/access/domain/session';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { Filter, Pager } from '@/sections/shared/filters';
import { catalogApi } from '@/shared/session/catalog-api';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

// Lo que cabe de un vistazo; la API no deja pedir mas de 50.
const PAGE_SIZE = 20;

interface Params {
  q?: string;
  bodega?: string;
  pagina?: string;
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.availability.search')) {
    return (
      <p className="text-muted text-sm" data-testid="availability-forbidden">
        Tu rol no tiene permiso para ver la disponibilidad de esta empresa.
      </p>
    );
  }

  const { q, bodega, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina ?? '1') || 1);
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let availability;
  try {
    availability = await salesApi().searchAvailability(token, {
      q,
      warehouseId: bodega,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="availability-error">
        {readableSalesError(error, 'No se pudo cargar la disponibilidad.')}
      </p>
    );
  }

  const rows = availability.availability;
  const pageHref = (next: number) =>
    `/ventas/disponibilidad?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(bodega ? { bodega } : {}),
      ...(next > 1 ? { pagina: String(next) } : {}),
    }).toString()}`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Disponibilidad</h2>
        <p className="text-muted mt-1 text-sm">Lo que hay, lo que ya reservaron los pedidos confirmados y lo que queda para vender.</p>
      </div>

      <div className="border-line space-y-3 rounded-lg border p-3">
        {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
        <form method="get" className="flex flex-wrap items-end gap-2" data-testid="availability-filter">
          <Filter label="Buscar" htmlFor="availability-search">
            <input
              id="availability-search"
              name="q"
              defaultValue={q ?? ''}
              placeholder="SKU o nombre"
              data-testid="availability-search"
              className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
            />
          </Filter>

          {warehouses.length > 0 ? (
            <Filter label="Bodega" htmlFor="availability-filter-warehouse">
              <select
                id="availability-filter-warehouse"
                name="bodega"
                defaultValue={bodega ?? ''}
                data-testid="availability-warehouse"
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
            data-testid="availability-filter-submit"
            className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
          >
            Filtrar
          </button>
        </form>

        <Pager
          testId="availability"
          page={page}
          pageSize={PAGE_SIZE}
          count={rows.length}
          total={availability.total}
          hasMore={availability.hasMore}
          href={pageHref}
        />
      </div>

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="availability-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 text-right font-medium">Existencia</th>
              <th className="px-4 py-2 text-right font-medium">Reservado</th>
              <th className="px-4 py-2 text-right font-medium">Disponible</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = `${row.item.sku}-${row.warehouse.name}`;

              return (
                <tr key={key} className="border-line border-t" data-testid={`availability-row-${key}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.item.name}</p>
                    <p className="text-muted font-mono text-xs">{row.item.sku}</p>
                  </td>
                  <td className="px-4 py-3">{row.warehouse.name}</td>
                  <td className="px-4 py-3 text-right">{formatQuantity(row.onHand)} {row.item.baseUnit}</td>
                  <td className="px-4 py-3 text-right" data-testid={`availability-reserved-${key}`}>
                    {formatQuantity(row.reserved)} {row.item.baseUnit}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" data-testid={`availability-available-${key}`}>
                    {formatQuantity(row.available)} {row.item.baseUnit}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted px-4 py-6 text-center" data-testid="availability-empty">
                  No hay existencia ni reservas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
