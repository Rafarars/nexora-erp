'use client';

import { TextArea } from '@/sections/shared/field';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { receivableLines } from '@/modules/purchasing/domain/purchasing';
import type { GoodsReceipt, PurchaseOrder } from '@/modules/purchasing/domain/purchasing';

// Cuanto llego de cada linea de la orden. Se propone lo pendiente al crear; al editar, lo que
// el borrador ya lleva. Una linea en blanco no llego en esta entrada.
export function ReceiptFields({ order, receipt, today }: { order: PurchaseOrder; receipt: GoodsReceipt | null; today: string }) {
  const lines = receivableLines(order, receipt);

  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />

      <div className="space-y-1.5">
        <label htmlFor="receipt-date" className="text-sm font-medium">
          Fecha de llegada
        </label>
        <input
          id="receipt-date"
          name="date"
          type="date"
          max={today}
          defaultValue={receipt?.date ?? today}
          data-testid="receipt-date"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2" data-testid="receipt-lines-editor">
        <legend className="text-sm font-medium">Lo que llegó</legend>
        <p className="text-muted text-xs">En la unidad de la orden. No puede superar lo pendiente.</p>

        {lines.map(({ line, quantity }, index) => (
          <div key={line.id} className="border-line flex items-center gap-2 rounded-md border p-2" data-testid={`receipt-line-${line.sku}`}>
            <input type="hidden" name="receiptLine" value={line.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {line.sku} — {line.itemName}
              </p>
              <p className="text-muted text-xs">
                Pendiente: {formatQuantity(line.pendingQuantity)} {line.unitAbbreviation}
              </p>
            </div>
            <input
              name="receiptQuantity"
              inputMode="decimal"
              aria-label={`Cantidad recibida de ${line.sku}`}
              defaultValue={receipt ? (quantity > 0 ? formatQuantity(quantity) : '') : formatQuantity(line.pendingQuantity)}
              data-testid={`receipt-quantity-${index}`}
              className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-right text-sm"
            />
            <span className="text-muted w-8 text-xs">{line.unitAbbreviation}</span>
          </div>
        ))}
      </fieldset>

      <TextArea label="Notas" name="notes" testId="receipt-notes" defaultValue={receipt?.notes ?? ''} />
    </>
  );
}
