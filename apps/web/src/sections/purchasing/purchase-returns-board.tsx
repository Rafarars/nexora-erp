'use client';

import { useActionState, useState } from 'react';
import { changePurchaseReturn, savePurchaseReturn } from '@/app/(app)/compras/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import {
  PURCHASE_RETURN_STATUS_LABELS,
  purchaseReturnActions,
  summarizePurchaseReturnLines,
} from '@/modules/purchasing/domain/purchasing';
import type {
  GoodsReceipt,
  PurchaseReturn,
} from '@/modules/purchasing/domain/purchasing';
import { Filter, Pager } from '@/sections/shared/filters';

export interface PurchaseReturnSearch {
  q: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function PurchaseReturnsBoard({
  returns,
  search,
  receipts,
  today,
  canCreate,
  canUpdate = false,
  canConfirm,
  canCancel,
}: {
  returns: PurchaseReturn[];
  search: PurchaseReturnSearch;
  receipts: GoodsReceipt[];
  today: string;
  canCreate: boolean;
  canUpdate?: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PurchaseReturn | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>('');

  function openCreate() {
    setEditing(null);
    setSelectedReceiptId('');
    setCreating(true);
  }

  function openEdit(ret: PurchaseReturn) {
    setCreating(false);
    setEditing(ret);
    setSelectedReceiptId(ret.receipt.id);
  }

  function closePanel() {
    setCreating(false);
    setEditing(null);
    setSelectedReceiptId('');
  }

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await savePurchaseReturn(previous, form);
    if (result.done) {
      closePanel();
    }
    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changePurchaseReturn, emptyState);

  const selectedReceipt = receipts.find((r) => r.id === selectedReceiptId) ?? null;
  const hasOptions = canUpdate || canConfirm || canCancel;

  const pageHref = (page: number) =>
    `/compras/devoluciones?${new URLSearchParams({
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
          <h2 className="text-base font-semibold">Devoluciones de compra</h2>
          <p className="text-muted mt-1 text-sm">
            Mercancía devuelta al proveedor. Baja la existencia al costo congelado de la entrada.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium"
            onClick={openCreate}
            data-testid="btn-new-purchase-return"
          >
            Nueva devolución
          </button>
        ) : null}
      </div>

      <PurchaseReturnFilters search={search} />

      <FormError message={changeState.error} testId="purchase-return-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="purchase-returns-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Entrada</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Líneas</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {returns.map((ret) => {
              const actions = purchaseReturnActions(ret);
              const offered = {
                edit: canUpdate && actions.edit,
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
              };
              const showMenu = offered.edit || offered.confirm || offered.cancel;

              return (
                <tr key={ret.id} className="border-line border-t hover:bg-surface/50" data-testid={`purchase-return-row-${ret.code}`}>
                  <td className="px-4 py-2 font-mono font-medium" data-testid="purchase-return-code">{ret.code}</td>
                  <td className="px-4 py-2">{ret.supplier.name}</td>
                  <td className="px-4 py-2 font-mono">{ret.receipt.code}</td>
                  <td className="px-4 py-2">{ret.date}</td>
                  <td className="text-muted max-w-xs truncate px-4 py-2 text-xs">
                    {summarizePurchaseReturnLines(ret.lines)}
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
                      data-testid={`purchase-return-status-${ret.code}`}
                    >
                      {PURCHASE_RETURN_STATUS_LABELS[ret.status]}
                    </span>
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-2 text-right">
                      {showMenu ? (
                        <RowOptions testId={`purchase-return-options-${ret.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton
                                  testId={`purchase-return-edit-${ret.code}`}
                                  onClick={() => {
                                    close();
                                    openEdit(ret);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={ret.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`purchase-return-confirm-${ret.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={ret.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`purchase-return-cancel-${ret.code}`}>
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
                <td colSpan={7} className="text-muted px-4 py-8 text-center text-sm" data-testid="purchase-returns-empty">
                  No hay devoluciones de compra registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pager
        testId="purchase-return-pager"
        page={search.page}
        pageSize={search.pageSize}
        count={returns.length}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />

      <SlideOver
        title={editing ? `Editar devolución ${editing.code}` : 'Nueva devolución de compra'}
        open={creating || Boolean(editing)}
        onClose={closePanel}
        testId="purchase-return-create-panel"
      >
        <form action={save} className="space-y-4" data-testid="purchase-return-form">
          <FormError message={saveState.error} testId="purchase-return-form-error" />

          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <div>
            <label htmlFor="receiptSelect" className="block text-xs font-medium uppercase tracking-wide">
              Entrada de origen *
            </label>
            <select
              id="receiptSelect"
              name={editing ? undefined : 'receiptId'}
              required
              disabled={Boolean(editing)}
              value={selectedReceiptId}
              onChange={(e) => setSelectedReceiptId(e.target.value)}
              className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm disabled:opacity-60"
              data-testid="purchase-return-receipt-select"
            >
              <option value="">Selecciona una entrada...</option>
              {receipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.supplier.name} ({r.date})
                </option>
              ))}
              {editing && !receipts.some((r) => r.id === editing.receipt.id) ? (
                <option value={editing.receipt.id}>{editing.receipt.code}</option>
              ) : null}
            </select>
            {editing ? <input type="hidden" name="receiptId" value={editing.receipt.id} /> : null}
          </div>

          {selectedReceipt ? (
            <>
              <input type="hidden" name="supplierId" value={selectedReceipt.supplier.id} />

              <div>
                <label htmlFor="returnDate" className="block text-xs font-medium uppercase tracking-wide">
                  Fecha
                </label>
                <input
                  id="returnDate"
                  type="date"
                  name="date"
                  defaultValue={editing?.date ?? today}
                  max={today}
                  key={`date-${editing?.id ?? 'new'}`}
                  className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  data-testid="purchase-return-date-input"
                />
              </div>

              <div>
                <label htmlFor="returnReason" className="block text-xs font-medium uppercase tracking-wide">
                  Motivo
                </label>
                <input
                  id="returnReason"
                  type="text"
                  name="reason"
                  placeholder="Ej. Mercancía defectuosa, no solicitada..."
                  defaultValue={editing?.reason ?? ''}
                  key={`reason-${editing?.id ?? 'new'}`}
                  className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  data-testid="purchase-return-reason-input"
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
                  defaultValue={editing?.notes ?? ''}
                  key={`notes-${editing?.id ?? 'new'}`}
                  className="border-line bg-surface mt-1 w-full rounded border px-3 py-1.5 text-sm"
                  data-testid="purchase-return-notes-input"
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide">Líneas a devolver</h3>
                <div className="space-y-3">
                  {selectedReceipt.lines.map((line) => {
                    const existingLine = editing?.lines.find(
                      (l) => l.receiptLineId === line.id || (l.itemId === line.itemId && !l.receiptLineId),
                    );
                    const defaultQty = existingLine ? existingLine.quantity : 0;

                    return (
                      <div key={line.id} className="border-line bg-surface/30 flex items-center justify-between rounded border p-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{line.itemName}</p>
                          <p className="text-muted text-xs">
                            {line.sku} · Recibidas: {line.quantity} {line.unitAbbreviation}
                          </p>
                          <input type="hidden" name="receiptLineId" value={line.id} />
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
                            defaultValue={defaultQty}
                            key={`qty-${editing?.id ?? 'new'}-${line.id}`}
                            className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-right text-sm"
                            data-testid={`purchase-return-qty-${line.id}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePanel}
                  className="border-line rounded border px-3 py-1.5 text-sm font-medium hover:bg-surface"
                >
                  Cancelar
                </button>
                <SubmitButton pending={saving} testId="btn-save-purchase-return">
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

function PurchaseReturnFilters({ search }: { search: PurchaseReturnSearch }) {
  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="purchase-return-filter">
        <Filter label="Buscar" htmlFor="purchase-return-search">
          <input
            id="purchase-return-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código, proveedor, entrada..."
            className="border-line bg-surface w-48 rounded border px-2 py-1 text-sm"
            data-testid="purchase-return-filter-q"
          />
        </Filter>
        <Filter label="Estado" htmlFor="purchase-return-status">
          <select
            id="purchase-return-status"
            name="estado"
            defaultValue={search.status}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="purchase-return-filter-status"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Anulada</option>
          </select>
        </Filter>
        <Filter label="Desde" htmlFor="purchase-return-from">
          <input
            id="purchase-return-from"
            type="date"
            name="desde"
            defaultValue={search.from}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="purchase-return-filter-from"
          />
        </Filter>
        <Filter label="Hasta" htmlFor="purchase-return-to">
          <input
            id="purchase-return-to"
            type="date"
            name="hasta"
            defaultValue={search.to}
            className="border-line bg-surface rounded border px-2 py-1 text-sm"
            data-testid="purchase-return-filter-to"
          />
        </Filter>
        <button
          type="submit"
          className="border-line rounded border px-3 py-1 text-sm hover:bg-surface"
          data-testid="purchase-return-filter-submit"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
