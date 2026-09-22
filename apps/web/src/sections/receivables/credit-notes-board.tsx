'use client';

import { useActionState, useState } from 'react';
import { changeCreditNote, saveCreditNote } from '@/app/(app)/cuentas-por-cobrar/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import {
  CREDIT_NOTE_REASON_LABELS,
  CREDIT_NOTE_STATUS_LABELS,
  creditNoteActions,
} from '@/modules/receivables/domain/receivables';
import type {
  CreditNote,
  CreditNoteReason,
  CustomerBalance,
  Receivable,
} from '@/modules/receivables/domain/receivables';
import { Filter, Pager } from '@/sections/shared/filters';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

export interface CreditNoteSearch {
  q: string;
  customerId: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function CreditNotesBoard({
  creditNotes,
  search,
  receivables,
  customers,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  creditNotes: CreditNote[];
  search: CreditNoteSearch;
  receivables: Receivable[];
  customers: CustomerBalance['customer'][];
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [editing, setEditing] = useState<CreditNote | null>(null);
  const [creating, setCreating] = useState(false);
  const hasOptions = canUpdate || canConfirm || canCancel;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveCreditNote(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changeCreditNote, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Notas de crédito</h2>
          <p className="text-muted mt-1 text-sm">
            Disminuyen la deuda del cliente por devoluciones, descuentos o correcciones.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-credit-note"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nueva nota de crédito
          </button>
        ) : null}
      </div>

      <CreditNoteFilters search={search} customers={customers} count={creditNotes.length} />

      <FormError message={changeState.error} testId="credit-note-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="credit-notes-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Motivo</th>
              <th className="px-4 py-2 font-medium">Factura / Devolución</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Crédito disponible</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((note) => {
              const actions = creditNoteActions(note);
              const offered = {
                edit: canUpdate && actions.edit,
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
              };

              return (
                <tr key={note.id} className="border-line border-t align-top" data-testid={`credit-note-row-${note.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{note.code}</p>
                    <p className="text-muted text-xs">{note.issueDate}</p>
                  </td>
                  <td className="px-4 py-3">{note.customer.name}</td>
                  <td className="px-4 py-3">
                    <p>{CREDIT_NOTE_REASON_LABELS[note.reason]}</p>
                    {note.reasonDetail ? <p className="text-muted text-xs">{note.reasonDetail}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {note.invoice ? (
                      <p data-testid={`credit-note-invoice-${note.code}`}>
                        Factura: <span className="font-mono">{note.invoice.code}</span>
                      </p>
                    ) : null}
                    {note.salesReturnId ? (
                      <p className="text-muted" data-testid={`credit-note-return-${note.code}`}>
                        Devolución: <span className="font-mono">{note.salesReturnId.slice(0, 8)}</span>
                      </p>
                    ) : null}
                    {!note.invoice && !note.salesReturnId ? <span className="text-muted">—</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p data-testid={`credit-note-total-${note.code}`}>
                      {note.currency.code} {formatAmount(note.total)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {note.status === 'confirmed' ? (
                      <p className="font-medium text-emerald-600 dark:text-emerald-400" data-testid={`credit-note-available-${note.code}`}>
                        {note.currency.code} {formatAmount(note.availableCredit)}
                      </p>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-testid={`credit-note-status-${note.code}`}>
                    {CREDIT_NOTE_STATUS_LABELS[note.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`credit-note-options-${note.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton
                                  testId={`credit-note-edit-${note.code}`}
                                  onClick={() => {
                                    close();
                                    setEditing(note);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={note.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`credit-note-confirm-${note.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={note.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`credit-note-cancel-${note.code}`}>
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

            {creditNotes.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted px-4 py-6 text-center" data-testid="credit-notes-empty">
                  Ninguna nota de crédito coincide con lo que buscas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nueva nota de crédito'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="credit-note-panel"
      >
        <form onSubmit={submitKeepingValues(save)} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <CreditNoteFields
            note={editing}
            customers={customers}
            receivables={receivables}
          />
          <FormError message={saveState.error} testId="credit-note-error" />
          <SubmitButton pending={saving} testId="credit-note-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

function CreditNoteFilters({
  search,
  customers,
  count,
}: {
  search: CreditNoteSearch;
  customers: CustomerBalance['customer'][];
  count: number;
}) {
  const pageHref = (page: number) =>
    `/cuentas-por-cobrar/notas-de-credito?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.customerId ? { cliente: search.customerId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="credit-note-filter">
        <Filter label="Buscar" htmlFor="credit-note-search">
          <input
            id="credit-note-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código de la nota o notas..."
            data-testid="credit-note-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {customers.length > 0 ? (
          <Filter label="Cliente" htmlFor="credit-note-filter-customer">
            <select
              id="credit-note-filter-customer"
              name="cliente"
              defaultValue={search.customerId}
              data-testid="credit-note-filter-customer"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Filter>
        ) : null}

        <Filter label="Estado" htmlFor="credit-note-filter-status">
          <select
            id="credit-note-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="credit-note-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Anulada</option>
          </select>
        </Filter>

        <Filter label="Desde" htmlFor="credit-note-filter-from">
          <input
            id="credit-note-filter-from"
            name="desde"
            type="date"
            defaultValue={search.from}
            data-testid="credit-note-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Hasta" htmlFor="credit-note-filter-to">
          <input
            id="credit-note-filter-to"
            name="hasta"
            type="date"
            defaultValue={search.to}
            data-testid="credit-note-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <button
          type="submit"
          data-testid="credit-note-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="credit-note"
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

function CreditNoteFields({
  note,
  customers,
  receivables,
}: {
  note: CreditNote | null;
  customers: CustomerBalance['customer'][];
  receivables: Receivable[];
}) {
  const [selectedCustomer, setSelectedCustomer] = useState(note?.customer.id ?? customers[0]?.id ?? '');
  const [reason, setReason] = useState<CreditNoteReason>(note?.reason ?? 'subsequent_discount');
  const [lines, setLines] = useState<
    { id?: string; concept: string; quantity: string; unitPrice: string; taxRate: string }[]
  >(
    note?.lines?.length
      ? note.lines.map((l) => ({
          id: l.id,
          concept: l.concept ?? '',
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          taxRate: String(l.taxRate),
        }))
      : [{ concept: 'Descuento posterior', quantity: '1', unitPrice: '0', taxRate: '0' }],
  );

  const availableInvoices = receivables.filter((r) => r.customer.id === selectedCustomer);

  const addLine = () => {
    setLines([...lines, { concept: '', quantity: '1', unitPrice: '0', taxRate: '0' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-muted block text-xs font-medium">Cliente</label>
        <select
          name="customerId"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          data-testid="credit-note-customer"
          className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
          required
        >
          <option value="">Selecciona un cliente</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-muted block text-xs font-medium">Factura afectada (opcional)</label>
        <select
          name="invoiceId"
          defaultValue={note?.invoice?.id ?? ''}
          data-testid="credit-note-invoice"
          className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Sin factura asociada</option>
          {availableInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.code} (Saldo: {inv.currency} {formatAmount(inv.balance)})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted block text-xs font-medium">Fecha de emisión</label>
          <input
            type="date"
            name="issueDate"
            defaultValue={note?.issueDate ?? new Date().toISOString().slice(0, 10)}
            data-testid="credit-note-date"
            className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-muted block text-xs font-medium">Motivo</label>
          <select
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as CreditNoteReason)}
            data-testid="credit-note-reason"
            className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
            required
          >
            {Object.entries(CREDIT_NOTE_REASON_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reason === 'other' ? (
        <div>
          <label className="text-muted block text-xs font-medium">Detalle del motivo (obligatorio para Otro)</label>
          <input
            type="text"
            name="reasonDetail"
            defaultValue={note?.reasonDetail ?? ''}
            data-testid="credit-note-reason-detail"
            placeholder="Especifica el motivo..."
            className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
            required
          />
        </div>
      ) : null}

      <div>
        <TextArea
          label="Notas internas (opcional)"
          name="notes"
          defaultValue={note?.notes ?? ''}
          testId="credit-note-notes"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-muted block text-xs font-medium uppercase tracking-wide">Conceptos / Líneas</label>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            data-testid="add-line-button"
          >
            + Agregar línea
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="border-line rounded-md border p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Línea {idx + 1}</span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-red-500 hover:underline"
                    data-testid={`remove-line-${idx}`}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>

              <div>
                <label className="text-muted block text-[10px]">Concepto</label>
                <input
                  type="text"
                  name="lineConcept"
                  defaultValue={line.concept}
                  placeholder="Descripción del descuento o ajuste"
                  className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-muted block text-[10px]">Cantidad</label>
                  <input
                    type="number"
                    step="any"
                    name="lineQuantity"
                    defaultValue={line.quantity}
                    className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-muted block text-[10px]">Precio unitario</label>
                  <input
                    type="number"
                    step="any"
                    name="linePrice"
                    defaultValue={line.unitPrice}
                    className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-muted block text-[10px]">Alícuota IVA (%)</label>
                  <input
                    type="number"
                    step="any"
                    name="lineTax"
                    defaultValue={line.taxRate}
                    className="border-line bg-surface mt-0.5 w-full rounded border px-2 py-1 text-xs"
                    required
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
