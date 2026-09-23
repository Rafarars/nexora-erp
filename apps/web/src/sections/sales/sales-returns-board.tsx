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
  Customer,
  Dispatch,
  SalesReturn,
} from '@/modules/sales/domain/sales';
import type { Warehouse } from '@/modules/catalog/domain/catalog';
import type { Item } from '@/modules/inventory/domain/item';
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
  customers,
  warehouses,
  items,
  today,
  canCreate,
  canConfirm,
  canCancel,
}: {
  returns: SalesReturn[];
  search: SalesReturnSearch;
  dispatches: Dispatch[];
  customers?: Customer[];
  warehouses?: Warehouse[];
  items?: Item[];
  today: string;
  canCreate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string>('');
  const [originlessLines, setOriginlessLines] = useState<{ itemId: string; unitId: string; quantity: string; unitCost: string }[]>([
    { itemId: '', unitId: '', quantity: '1', unitCost: '' },
  ]);

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
              name={selectedDispatchId === 'none' ? undefined : 'dispatchId'}
              required
              value={selectedDispatchId}
              onChange={(e) => setSelectedDispatchId(e.target.value)}
              className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
              data-testid="sales-return-dispatch-select"
            >
              <option value="">Selecciona un despacho o devolución sin origen...</option>
              <option value="none">Sin despacho (ajuste con costo manual)</option>
              {dispatches.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.customer.name} ({d.date})
                </option>
              ))}
            </select>
          </div>

          {selectedDispatchId === 'none' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="returnCustomer" className="block text-xs font-medium uppercase tracking-wide">
                    Cliente *
                  </label>
                  <select
                    id="returnCustomer"
                    name="customerId"
                    required
                    className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                    data-testid="sales-return-customer-select"
                  >
                    <option value="">Selecciona un cliente...</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="returnWarehouse" className="block text-xs font-medium uppercase tracking-wide">
                    Bodega de reingreso *
                  </label>
                  <select
                    id="returnWarehouse"
                    name="warehouseId"
                    required
                    className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                    data-testid="sales-return-warehouse-select"
                  >
                    <option value="">Selecciona una bodega...</option>
                    {warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  placeholder="Ej. Producto vendido antes del sistema..."
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
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide">Líneas a devolver</h3>
                  <button
                    type="button"
                    onClick={() => setOriginlessLines([...originlessLines, { itemId: '', unitId: '', quantity: '1', unitCost: '' }])}
                    className="text-xs text-primary hover:underline"
                    data-testid="btn-add-return-line"
                  >
                    + Agregar línea
                  </button>
                </div>
                <div className="space-y-3">
                  {originlessLines.map((row, index) => {
                    const selectedItem = items?.find((it) => it.id === row.itemId);
                    return (
                      <div key={index} className="border-line bg-surface/30 space-y-2 rounded border p-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-muted uppercase">Artículo</label>
                            <select
                              name="itemId"
                              required
                              value={row.itemId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const it = items?.find((x) => x.id === newId);
                                const newLines = [...originlessLines];
                                newLines[index].itemId = newId;
                                newLines[index].unitId = it?.units[0]?.unitId ?? '';
                                setOriginlessLines(newLines);
                              }}
                              className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-sm"
                              data-testid={`sales-return-item-${index}`}
                            >
                              <option value="">Selecciona un artículo...</option>
                              {items?.filter((it) => it.type === 'inventoried' && it.isActive).map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.sku} — {it.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted uppercase">Unidad</label>
                            <select
                              name="unitId"
                              required
                              value={row.unitId}
                              onChange={(e) => {
                                const newLines = [...originlessLines];
                                newLines[index].unitId = e.target.value;
                                setOriginlessLines(newLines);
                              }}
                              className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-sm"
                              data-testid={`sales-return-unit-${index}`}
                            >
                              <option value="">Selecciona unidad...</option>
                              {selectedItem?.units.map((u) => (
                                <option key={u.unitId} value={u.unitId}>
                                  {u.name} ({u.abbreviation})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-muted uppercase">Cantidad</label>
                            <input
                              type="number"
                              name="returnQuantity"
                              required
                              step="any"
                              min="0.0001"
                              value={row.quantity}
                              onChange={(e) => {
                                const newLines = [...originlessLines];
                                newLines[index].quantity = e.target.value;
                                setOriginlessLines(newLines);
                              }}
                              className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-right text-sm"
                              data-testid={`sales-return-qty-${index}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted uppercase">Costo unitario ($)</label>
                            <input
                              type="number"
                              name="unitCost"
                              required
                              step="any"
                              min="0"
                              value={row.unitCost}
                              onChange={(e) => {
                                const newLines = [...originlessLines];
                                newLines[index].unitCost = e.target.value;
                                setOriginlessLines(newLines);
                              }}
                              className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-right text-sm"
                              data-testid={`sales-return-unit-cost-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
