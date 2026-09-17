'use client';

import { useActionState, useState } from 'react';
import { changeDispatch, saveDispatch } from '@/app/(app)/ventas/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { DISPATCH_STATUS_LABELS, dispatchActions, summarizeDispatchLines } from '@/modules/sales/domain/sales';
import type { Dispatch, SalesOrder } from '@/modules/sales/domain/sales';
import { DispatchFields } from './dispatch-fields';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

// Los despachos se crean desde su pedido ("Despachar"); aqui se revisan, se confirman, se
// facturan y se anulan.
export function DispatchesBoard({
  dispatches,
  orders,
  today,
  canUpdate,
  canConfirm,
  canCancel,
  canInvoice,
}: {
  dispatches: Dispatch[];
  orders: SalesOrder[];
  today: string;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canInvoice: boolean;
}) {
  const [editing, setEditing] = useState<Dispatch | null>(null);
  const hasOptions = canUpdate || canConfirm || canCancel || canInvoice;
  const orderOf = (dispatch: Dispatch) => orders.find((order) => order.id === dispatch.order.id) ?? null;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveDispatch(previous, form);

    if (result.done) setEditing(null);

    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changeDispatch, emptyState);
  const editingOrder = editing ? orderOf(editing) : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Despachos</h2>
        <p className="text-muted mt-1 text-sm">
          Se crean desde su pedido. Confirmar baja la existencia; anular la devuelve, si no está facturado.
        </p>
      </div>

      <FormError message={changeState.error} testId="dispatch-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="dispatches-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Pedido</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 font-medium">Salió</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {dispatches.map((dispatch) => {
              const actions = dispatchActions(dispatch);
              const offered = {
                edit: canUpdate && actions.edit && orderOf(dispatch) !== null,
                confirm: canConfirm && actions.confirm,
                invoice: canInvoice && actions.invoice,
                cancel: canCancel && actions.cancel,
              };

              return (
                <tr key={dispatch.id} className="border-line border-t align-top" data-testid={`dispatch-row-${dispatch.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{dispatch.code}</p>
                    <p className="text-muted text-xs">{dispatch.date}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{dispatch.order.code}</p>
                    <p className="text-muted text-xs">{dispatch.customer.name}</p>
                  </td>
                  <td className="px-4 py-3">{dispatch.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <p data-testid={`dispatch-lines-${dispatch.code}`}>{summarizeDispatchLines(dispatch.lines)}</p>
                    {dispatch.notes ? <p className="text-muted text-xs">{dispatch.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3" data-testid={`dispatch-status-${dispatch.code}`}>
                    <p>{DISPATCH_STATUS_LABELS[dispatch.status]}</p>
                    {dispatch.invoice ? <p className="text-muted font-mono text-xs">{dispatch.invoice.code}</p> : null}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`dispatch-options-${dispatch.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton testId={`dispatch-edit-${dispatch.code}`} onClick={() => { close(); setEditing(dispatch); }}>
                                  Editar
                                </MenuButton>
                              ) : null}
                              {(['confirm', 'invoice', 'cancel'] as const)
                                .filter((extra) => offered[extra])
                                .map((extra) => (
                                  <form key={extra} action={change} onSubmit={close}>
                                    <input type="hidden" name="id" value={dispatch.id} />
                                    <input type="hidden" name="extra" value={extra} />
                                    <MenuButton type="submit" testId={`dispatch-${extra}-${dispatch.code}`}>
                                      {extra === 'confirm' ? 'Confirmar' : extra === 'invoice' ? 'Facturar' : dispatch.status === 'confirmed' ? 'Anular (devuelve la existencia)' : 'Anular'}
                                    </MenuButton>
                                  </form>
                                ))}
                            </>
                          )}
                        </RowOptions>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {dispatches.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-6 text-center" data-testid="dispatches-empty">
                  Todavía no hay despachos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver title={editing ? `Editar ${editing.code}` : ''} open={editing !== null} onClose={() => setEditing(null)} testId="dispatch-edit-panel">
        {editing && editingOrder ? (
          <form onSubmit={submitKeepingValues(save)} className="space-y-4" key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <DispatchFields order={editingOrder} dispatch={editing} today={today} />
            <FormError message={saveState.error} testId="dispatch-edit-error" />
            <SubmitButton pending={saving} testId="dispatch-edit-submit">
              Guardar borrador
            </SubmitButton>
          </form>
        ) : null}
      </SlideOver>
    </section>
  );
}
