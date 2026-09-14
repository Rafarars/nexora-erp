'use client';

import { TextArea } from '@/sections/shared/field';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { dispatchableLines } from '@/modules/sales/domain/sales';
import type { Dispatch, SalesOrder } from '@/modules/sales/domain/sales';

// Cuanto sale de cada linea del pedido. Se propone lo pendiente al crear; al editar, lo que
// el borrador ya lleva. Una linea en blanco no sale en este despacho.
export function DispatchFields({ order, dispatch, today }: { order: SalesOrder; dispatch: Dispatch | null; today: string }) {
  const lines = dispatchableLines(order, dispatch);

  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />

      <div className="space-y-1.5">
        <label htmlFor="dispatch-date" className="text-sm font-medium">
          Fecha de salida
        </label>
        <input
          id="dispatch-date"
          name="date"
          type="date"
          max={today}
          defaultValue={dispatch?.date ?? today}
          data-testid="dispatch-date"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2" data-testid="dispatch-lines-editor">
        <legend className="text-sm font-medium">Lo que sale</legend>
        <p className="text-muted text-xs">En la unidad del pedido. No puede superar lo pendiente.</p>

        {lines.map(({ line, quantity }, index) => (
          <div key={line.id} className="border-line flex items-center gap-2 rounded-md border p-2" data-testid={`dispatch-line-${line.sku}`}>
            <input type="hidden" name="dispatchLine" value={line.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {line.sku} — {line.itemName}
              </p>
              <p className="text-muted text-xs">
                Pendiente: {formatQuantity(line.pendingQuantity)} {line.unitAbbreviation}
              </p>
            </div>
            <input
              name="dispatchQuantity"
              inputMode="decimal"
              aria-label={`Cantidad despachada de ${line.sku}`}
              defaultValue={dispatch ? (quantity > 0 ? formatQuantity(quantity) : '') : formatQuantity(line.pendingQuantity)}
              data-testid={`dispatch-quantity-${index}`}
              className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-right text-sm"
            />
            <span className="text-muted w-8 text-xs">{line.unitAbbreviation}</span>
          </div>
        ))}
      </fieldset>

      <TextArea label="Notas" name="notes" testId="dispatch-notes" defaultValue={dispatch?.notes ?? ''} />
    </>
  );
}
