import { can } from '@/modules/access/domain/session';
import { DIRECTION_LABELS, ORIGIN_LABELS, formatMoney, formatQuantity } from '@/modules/inventory/domain/inventory';
import { readableInventoryError } from '@/modules/inventory/domain/inventory-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { inventoryApi } from '@/shared/session/inventory-api';
import { requireSession } from '@/shared/session/current-session';

export const dynamic = 'force-dynamic';

export default async function KardexPage({ searchParams }: { searchParams: Promise<{ articulo?: string; bodega?: string }> }) {
  const { session, token } = await requireSession();

  if (!can(session, 'inventory.movements.search')) {
    return (
      <p className="text-muted text-sm" data-testid="kardex-forbidden">
        Tu rol no tiene permiso para ver el kardex de esta empresa.
      </p>
    );
  }

  const { articulo, bodega } = await searchParams;
  const [items, warehouses] = await Promise.all([
    can(session, 'inventory.items.search') ? inventoryApi().searchItems(token) : [],
    can(session, 'catalog.warehouses.search') ? catalogApi().searchWarehouses(token) : [],
  ]);

  let movements = null;
  let failure = null;

  if (articulo) {
    try {
      movements = await inventoryApi().searchMovements(token, articulo, bodega || undefined);
    } catch (error) {
      failure = readableInventoryError(error, 'No se pudo cargar el kardex.');
    }
  }

  const unit = items.find((item) => item.id === articulo)?.units.find((u) => u.isBase)?.abbreviation ?? '';

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Kardex</h2>
        <p className="text-muted mt-1 text-sm">
          Cada movimiento de un artículo, en orden. Nada se borra: una anulación aparece como su contrapartida.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" data-testid="kardex-filter">
        <div className="space-y-1">
          <label htmlFor="articulo" className="block text-sm">
            Artículo
          </label>
          <select
            id="articulo"
            name="articulo"
            defaultValue={articulo ?? ''}
            data-testid="kardex-item"
            className="border-line bg-background rounded-md border px-2 py-1 text-sm"
          >
            <option value="">Elige un artículo</option>
            {items
              .filter((item) => item.type === 'inventoried')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="bodega-kardex" className="block text-sm">
            Bodega
          </label>
          <select
            id="bodega-kardex"
            name="bodega"
            defaultValue={bodega ?? ''}
            data-testid="kardex-warehouse"
            className="border-line bg-background rounded-md border px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" data-testid="kardex-submit" className="border-line rounded-md border px-2 py-1 text-sm">
          Ver kardex
        </button>
      </form>

      {failure ? (
        <p className="text-sm text-red-500" data-testid="kardex-error">
          {failure}
        </p>
      ) : null}

      {movements ? (
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="kardex-table">
            <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Bodega</th>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                <th className="px-4 py-2 text-right font-medium">Costo</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
                <th className="px-4 py-2 text-right font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr
                  key={movement.id}
                  className="border-line border-t"
                  data-testid={`kardex-row-${movement.warehouse.name}-${movement.sequence}`}
                >
                  <td className="text-muted px-4 py-3">{movement.sequence}</td>
                  <td className="px-4 py-3">{movement.warehouse.name}</td>
                  <td className="px-4 py-3" data-testid={`kardex-origin-${movement.warehouse.name}-${movement.sequence}`}>
                    <p className="font-mono text-xs">{movement.origin.code}</p>
                    <p className="text-muted text-xs">{ORIGIN_LABELS[movement.origin.type]}</p>
                  </td>
                  <td className="px-4 py-3">
                    {DIRECTION_LABELS[movement.direction]}
                    {movement.isReversal ? <span className="text-muted"> (anulación)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {movement.direction === 'in' ? '+' : '−'}
                    {formatQuantity(movement.quantity)} {unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(movement.unitCost)}</td>
                  <td className="px-4 py-3 text-right" data-testid={`kardex-balance-${movement.warehouse.name}-${movement.sequence}`}>
                    {formatQuantity(movement.balanceQuantity)} {unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(movement.balanceAverageCost)}</td>
                </tr>
              ))}

              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted px-4 py-6 text-center" data-testid="kardex-empty">
                    Este artículo no tiene movimientos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
