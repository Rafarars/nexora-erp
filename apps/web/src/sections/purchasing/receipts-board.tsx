'use client';

import { useActionState, useState } from 'react';
import { changeReceipt, saveReceipt } from '@/app/(app)/compras/actions';
import { FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { RECEIPT_STATUS_LABELS, receiptActions, summarizeReceiptLines } from '@/modules/purchasing/domain/purchasing';
import type { GoodsReceipt, PurchaseOrder } from '@/modules/purchasing/domain/purchasing';
import { DocumentRate } from './document-rate';
import { MenuButton } from './menu-button';
import { ReceiptFields } from './receipt-fields';

// Las entradas se crean desde su orden ("Recibir mercancia"); aqui se revisan, se confirman
// y se anulan.
export function ReceiptsBoard({
  receipts,
  orders,
  baseCurrency,
  allowsRateOverride,
  today,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  receipts: GoodsReceipt[];
  orders: PurchaseOrder[];
  baseCurrency: string;
  allowsRateOverride: boolean;
  today: string;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [editing, setEditing] = useState<GoodsReceipt | null>(null);
  const hasOptions = canUpdate || canConfirm || canCancel;
  const orderOf = (receipt: GoodsReceipt) => orders.find((order) => order.id === receipt.order.id) ?? null;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveReceipt(previous, form);

    if (result.done) setEditing(null);

    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changeReceipt, emptyState);
  const editingOrder = editing ? orderOf(editing) : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Entradas de mercancía</h2>
        <p className="text-muted mt-1 text-sm">
          Se crean desde su orden. Confirmar sube la existencia al costo de la orden; anular la revierte si la mercancía sigue en la bodega.
        </p>
      </div>

      <FormError message={changeState.error} testId="receipt-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="receipts-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Orden</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 font-medium">Llegó</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => {
              const actions = receiptActions(receipt);
              const offered = {
                edit: canUpdate && actions.edit && orderOf(receipt) !== null,
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
              };

              return (
                <tr key={receipt.id} className="border-line border-t align-top" data-testid={`receipt-row-${receipt.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{receipt.code}</p>
                    <p className="text-muted text-xs">{receipt.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{receipt.order.code}</p>
                    <p className="text-muted text-xs">{receipt.supplier.name}</p>
                  </td>
                  <td className="px-4 py-3">{receipt.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <p data-testid={`receipt-lines-${receipt.code}`}>{summarizeReceiptLines(receipt.lines)}</p>
                    {receipt.notes ? <p className="text-muted text-xs">{receipt.notes}</p> : null}
                    <DocumentRate document={receipt} testId={`receipt-rate-${receipt.code}`} />
                  </td>
                  <td className="px-4 py-3" data-testid={`receipt-status-${receipt.code}`}>
                    {RECEIPT_STATUS_LABELS[receipt.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`receipt-options-${receipt.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton
                                  testId={`receipt-edit-${receipt.code}`}
                                  onClick={() => {
                                    close();
                                    setEditing(receipt);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={receipt.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`receipt-confirm-${receipt.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={receipt.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`receipt-cancel-${receipt.code}`}>
                                    {receipt.status === 'confirmed' ? 'Anular (revierte la existencia)' : 'Anular'}
                                  </MenuButton>
                                </form>
                              ) : null}
                            </>
                          )}
                        </RowOptions>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {receipts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-6 text-center" data-testid="receipts-empty">
                  Todavía no hay entradas de mercancía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver title={editing ? `Editar ${editing.code}` : ''} open={editing !== null} onClose={() => setEditing(null)} testId="receipt-panel">
        {editing && editingOrder ? (
          <form action={save} className="space-y-4" key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <ReceiptFields order={editingOrder} receipt={editing} today={today} baseCurrency={baseCurrency} allowsRateOverride={allowsRateOverride} />
            <FormError message={saveState.error} testId="receipt-error" />
            <SubmitButton pending={saving} testId="receipt-submit">
              Guardar borrador
            </SubmitButton>
          </form>
        ) : null}
      </SlideOver>
    </section>
  );
}
