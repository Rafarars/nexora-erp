import { can } from '@/modules/access/domain/session';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableSalesError } from '@/modules/sales/domain/sales-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { salesApi } from '@/shared/session/sales-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'sales.availability.search')) {
    return (
      <p className="text-muted text-sm" data-testid="availability-forbidden">
        Tu rol no tiene permiso para ver la disponibilidad de esta empresa.
      </p>
    );
  }

  const { bodega } = await searchParams;
  const warehouses = can(session, 'catalog.warehouses.search') ? await catalogApi().searchWarehouses(token) : [];

  let rows;
  try {
    rows = await salesApi().searchAvailability(token, bodega || undefined);
  } catch (error) {
    return (
      <p className="text-sm text-red-500" data-testid="availability-error">
        {readableSalesError(error, 'No se pudo cargar la disponibilidad.')}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Disponibilidad</h2>
          <p className="text-muted mt-1 text-sm">Lo que hay, lo que ya reservaron los pedidos confirmados y lo que queda para vender.</p>
        </div>

        {warehouses.length > 0 ? (
          <form className="flex items-center gap-2" data-testid="availability-filter">
            <label htmlFor="bodega" className="text-sm">
              Bodega
            </label>
            <select id="bodega" name="bodega" defaultValue={bodega ?? ''} data-testid="availability-warehouse" className="border-line bg-background rounded-md border px-2 py-1 text-sm">
              <option value="">Todas</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <button type="submit" data-testid="availability-filter-submit" className="border-line rounded-md border px-2 py-1 text-sm">
              Filtrar
            </button>
          </form>
        ) : null}
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
