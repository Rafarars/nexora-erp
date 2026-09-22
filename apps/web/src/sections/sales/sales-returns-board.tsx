'use client';

import { useActionState, useState } from 'react';
import { changeSalesReturn, saveSalesReturn } from '@/app/(app)/ventas/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import {
  RETURN_CONDITION_LABELS,
  SALES_RETURN_STATUS_LABELS,
  salesReturnActions,
  summarizeReturnLines,
} from '@/modules/sales/domain/sales';
import type {
  Dispatch,
  SalesReturn,
} from '@/modules/sales/domain/sales';
import { Filter, Pager } from '@/sections/shared/filters';

export interface SalesReturnSearch {
  q: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function SalesReturnsBoard({
  returns,
  search,
  dispatches,
  today,
  canCreate,
  canConfirm,
  canCancel,
}: {
  returns: SalesReturn[];
  search: SalesReturnSearch;
  dispatches: Dispatch[];
  today: string;
  canCreate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string>('');

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveSalesReturn(previous, form);
    if (result.done) {
      setCreating(false);
      setSelectedDispatchId('');
    }
    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changeSalesReturn, emptyState);

  const selectedDispatch = dispatches.find((d) => d.id === selectedDispatchId) ?? null;
  const hasOptions = canConfirm || canCancel;

  const pageHref = (page: number) =>
    `/ventas/devoluciones?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Devoluciones de venta</h2>
          <p className="text-muted mt-1 text-sm">
            Mercancía que el cliente devuelve. Reingresa al costo congelado de su despacho.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium"
            onClick={() => setCreating(true)}
            data-testid="btn-new-sales-return"
          >
            Nueva devolución
          </button>
        ) : null}
      </div>

      <SalesReturnFilters search={search} />

      <FormError message={changeState.error} testId="sales-return-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="sales-returns-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Despacho</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Condición</th>
              <th className="px-4 py-2 font-medium">Líneas</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {returns.map((ret) => {
              const actions = salesReturnActions(ret);
              const offered = {
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
              };
              const showMenu = offered.confirm || offered.cancel;

              return (
                <tr key={ret.id} className="border-line border-t hover:bg-surface/50" data-testid={`sales-return-row-${ret.code}`}>
                  <td className="px-4 py-2 font-mono font-medium" data-testid="sales-return-code">{ret.code}</td>
                  <td className="px-4 py-2">{ret.customer.name}</td>
                  <td className="px-4 py-2 font-mono">{ret.dispatch ? ret.dispatch.code : 'Sin origen'}</td>
                  <td className="px-4 py-2">{ret.date}</td>
                  <td className="px-4 py-2">
                    <span className="bg-surface border-line rounded border px-2 py-0.5 text-xs">
                      {RETURN_CONDITION_LABELS[ret.condition]}
                    </span>
                  </td>
                  <td className="text-muted max-w-xs truncate px-4 py-2 text-xs">
                    {summarizeReturnLines(ret.lines)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        ret.status === 'confirmed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : ret.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                      data-testid={`sales-return-status-${ret.code}`}
                    >
                      {SALES_RETURN_STATUS_LABELS[ret.status]}
                    </span>
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-2 text-right">
                      {showMenu ? (
                        <RowOptions testId={`sales-return-options-${ret.code}`}>
                          {(close) => (
                            <>
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={ret.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`sales-return-confirm-${ret.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={ret.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`sales-return-cancel-${ret.code}`}>
                                    Anular
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
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted px-4 py-8 text-center text-sm" data-testid="sales-returns-empty">
                  No hay devoluciones de venta registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pager
        testId="sales-return-pager"
        page={search.page}
        pageSize={search.pageSize}
        count={returns.length}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />

      <SlideOver
        title="Nueva devolución de venta"
        open={creating}
        onClose={() => setCreating(false)}
        testId="sales-return-create-panel"
      >
        <form action={save} className="space-y-4" data-testid="sales-return-form">
          <FormError message={saveState.error} testId="sales-return-form-error" />

          <div>
            <label htmlFor="dispatchSelect" className="block text-xs font-medium uppercase tracking-wide">
              Despacho de origen *
            </label>
            <select
              id="dispatchSelect"
              name="dispatchId"
              required
              value={selectedDispatchId}
              onChange={(e) => setSelectedDispatchId(e.target.value)}
              className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
              data-testid="sales-return-dispatch-select"
            >
              <option value="">Selecciona un despacho...</option>
              {dispatches.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.customer.name} ({d.date})
                </option>
              ))}
            </select>
          </div>

          {selectedDispatch ? (
            <>
              <input type="hidden" name="customerId" value={selectedDispatch.customer.id} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="returnDate" className="block text-xs font-medium uppercase tracking-wide">
                    Fecha
                  </label>
                  <input
                    id="returnDate"
                    type="date"
                    name="date"
                    defaultValue={today}
                    max={today}
                    className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                    data-testid="sales-return-date-input"
                  />
                </div>
                <div>
                  <label htmlFor="returnCondition" className="block text-xs font-medium uppercase tracking-wide">
                    Condición *
                  </label>
                  <select
                    id="returnCondition"
                    name="condition"
                    defaultValue="resalable"
                    className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                    data-testid="sales-return-condition-select"
                  >
                    <option value="resalable">Apta para reventa</option>
                    <option value="damaged">Dañada</option>
                    <option value="scrap">Desecho / Scrap</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="returnReason" className="block text-xs font-medium uppercase tracking-wide">
                  Motivo
                </label>
                <input
                  id="returnReason"
                  type="text"
                  name="reason"
                  placeholder="Ej. Producto defectuoso, error en pedido..."
                  className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  data-testid="sales-return-reason-input"
                />
              </div>

              <div>
                <label htmlFor="returnNotes" className="block text-xs font-medium uppercase tracking-wide">
                  Notas
                </label>
                <textarea
                  id="returnNotes"
                  name="notes"
                  rows={2}
                  className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  data-testid="sales-return-notes-input"
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide">Líneas a devolver</h3>
                <div className="space-y-3">
                  {selectedDispatch.lines.map((line) => (
                    <div key={line.id} className="border-line bg-surface/30 flex items-center justify-between rounded border p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{line.itemName}</p>
                        <p className="text-muted text-xs">
                          {line.sku} · Despachadas: {line.quantity} {line.unitAbbreviation}
                        </p>
                        <input type="hidden" name="dispatchLineId" value={line.id} />
                      </div>
                      <div className="w-32">
                        <label htmlFor={`qty-${line.id}`} className="block text-[10px] text-muted uppercase">
                          Cant. devolver
                        </label>
                        <input
                          id={`qty-${line.id}`}
                          type="number"
                          name="returnQuantity"
                          step="any"
                          min="0"
                          max={line.quantity}
                          defaultValue="0"
                          className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-right text-sm"
                          data-testid={`sales-return-qty-${line.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="border-line rounded border px-3 py-1.5 text-sm font-medium hover:bg-surface"
                >
                  Cancelar
                </button>
                <SubmitButton pending={saving} testId="btn-save-sales-return">
                  Guardar devolución
                </SubmitButton>
              </div>
            </>
          ) : null}
        </form>
      </SlideOver>
    </section>
  );
}

function SalesReturnFilters({ search }: { search: SalesReturnSearch }) {
  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="sales-return-filter">
        <Filter label="Buscar" htmlFor="sales-return-search">
          <input
            id="sales-return-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código, cliente, despacho..."
            className="border-line bg-surface w-48 rounded border px-2 py-1 text-sm"
            data-testid="sales-return-filter-q"
          />
        </Filter>
        <Filter label="Estado" htmlFor="sales-return-status">
          <select
            id="sales-return-status"
            name="estado"
            defaultValue={search.status}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="sales-return-filter-status"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Anulada</option>
          </select>
        </Filter>
        <Filter label="Desde" htmlFor="sales-return-from">
          <input
            id="sales-return-from"
            type="date"
            name="desde"
            defaultValue={search.from}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="sales-return-filter-from"
          />
        </Filter>
        <Filter label="Hasta" htmlFor="sales-return-to">
          <input
            id="sales-return-to"
            type="date"
            name="hasta"
            defaultValue={search.to}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="sales-return-filter-to"
          />
        </Filter>
        <button
          type="submit"
          className="border-line rounded border px-3 py-1 text-sm hover:bg-surface"
          data-testid="sales-return-filter-submit"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
