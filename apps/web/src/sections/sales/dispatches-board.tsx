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
import type { Dispatch, DispatchStatus, SalesOrder } from '@/modules/sales/domain/sales';
import type { Warehouse } from '@/modules/catalog/domain/catalog';
import { Filter, Pager } from '@/sections/shared/filters';
import { DispatchFields } from './dispatch-fields';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

export interface DispatchSearch {
  q: string;
  warehouseId: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Los despachos se crean desde su pedido ("Despachar"); aqui se revisan, se confirman, se
// facturan y se anulan.
export function DispatchesBoard({
  dispatches,
  search,
  orders,
  warehouses,
  today,
  canUpdate,
  canConfirm,
  canCancel,
  canInvoice,
}: {
  dispatches: Dispatch[];
  search: DispatchSearch;
  orders: SalesOrder[];
  warehouses: Warehouse[];
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

      <DispatchFilters search={search} warehouses={warehouses} count={dispatches.length} />

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

function DispatchFilters({ search, warehouses, count }: { search: DispatchSearch; warehouses: Warehouse[]; count: number }) {
  const pageHref = (page: number) =>
    `/ventas/despachos?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.warehouseId ? { bodega: search.warehouseId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="dispatch-filter">
        <Filter label="Buscar" htmlFor="dispatch-search">
          <input
            id="dispatch-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código del despacho o de su pedido"
            data-testid="dispatch-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {warehouses.length > 0 ? (
          <Filter label="Bodega" htmlFor="dispatch-filter-warehouse">
            <select
              id="dispatch-filter-warehouse"
              name="bodega"
              defaultValue={search.warehouseId}
              data-testid="dispatch-filter-warehouse"
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

        <Filter label="Estado" htmlFor="dispatch-filter-status">
          <select
            id="dispatch-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="dispatch-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(Object.keys(DISPATCH_STATUS_LABELS) as DispatchStatus[]).map((status) => (
              <option key={status} value={status}>
                {DISPATCH_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Filter>

        <Filter label="Desde" htmlFor="dispatch-filter-from">
          <input
            id="dispatch-filter-from"
            name="desde"
            type="date"
            defaultValue={search.from}
            data-testid="dispatch-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Hasta" htmlFor="dispatch-filter-to">
          <input
            id="dispatch-filter-to"
            name="hasta"
            type="date"
            defaultValue={search.to}
            data-testid="dispatch-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <button
          type="submit"
          data-testid="dispatch-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="dispatch"
        page={search.page}
        pageSize={search.pageSize}
        count={count}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />
    </div>
  );
}
