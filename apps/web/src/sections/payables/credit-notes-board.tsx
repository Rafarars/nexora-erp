'use client';

import { useActionState, useEffect, useState } from 'react';
import { changeCreditNote, getEligiblePurchaseReturns, getPurchaseInvoice, saveCreditNote } from '@/app/(app)/cuentas-por-pagar/actions';
import type { EligiblePurchaseReturn } from '@/app/(app)/cuentas-por-pagar/actions';
import type { PurchaseInvoiceLine } from '@/modules/purchasing/domain/purchasing';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import {
  CREDIT_NOTE_REASONS,
  CREDIT_NOTE_REASON_LABELS,
  CREDIT_NOTE_STATUS_LABELS,
  creditNoteActions,
} from '@/modules/payables/domain/payables';
import type {
  CreditNoteReason,
  PayableInvoice,
  SupplierBalance,
  SupplierCreditNote,
} from '@/modules/payables/domain/payables';
import { Filter, Pager } from '@/sections/shared/filters';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';
import { useEditingDraft } from '@/shared/forms/use-editing-draft';

export interface CreditNoteSearch {
  q: string;
  supplierId: string;
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
  invoices,
  suppliers,
  today,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  creditNotes: SupplierCreditNote[];
  search: CreditNoteSearch;
  invoices: PayableInvoice[];
  suppliers: SupplierBalance['supplier'][];
  today: string;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const { editing, setEditing, draftKey } = useEditingDraft(creditNotes);
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
            Disminuyen la deuda con el proveedor por devoluciones, descuentos o correcciones de precio.
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

      <CreditNoteFilters search={search} suppliers={suppliers} count={creditNotes.length} />

      <FormError message={changeState.error} testId="credit-note-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="credit-notes-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Motivo</th>
              <th className="px-4 py-2 font-medium">Factura / Devolución</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((note) => {
              const actions = creditNoteActions(note, canUpdate, canConfirm, canCancel);
              const offered = {
                edit: canUpdate && actions.canEdit,
                confirm: canConfirm && actions.canConfirm,
                cancel: canCancel && actions.canCancel,
              };

              return (
                <tr key={note.id} className="border-line border-t align-top" data-testid={`credit-note-row-${note.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{note.code}</p>
                    <p className="text-muted text-xs">{note.issueDate}</p>
                  </td>
                  <td className="px-4 py-3">{note.supplier.name}</td>
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
                    {note.purchaseReturn?.code || note.purchaseReturnCode ? (
                      <p className="text-muted" data-testid={`credit-note-return-${note.code}`}>
                        Devolución: <span className="font-mono">{note.purchaseReturn?.code ?? note.purchaseReturnCode}</span>
                      </p>
                    ) : null}
                    {!note.invoice && !note.purchaseReturn?.code && !note.purchaseReturnCode ? <span className="text-muted">—</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p data-testid={`credit-note-total-${note.code}`}>
                      {note.currency.code} {formatAmount(note.total)}
                    </p>
                    {note.availableCredit > 0 ? (
                      <p className="text-muted text-xs">
                        Disponible: {note.currency.code} {formatAmount(note.availableCredit)}
                      </p>
                    ) : null}
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
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="credit-notes-empty">
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
        <form onSubmit={submitKeepingValues(save)} className="space-y-4" key={draftKey()}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <CreditNoteFields
            note={editing}
            suppliers={suppliers}
            invoices={invoices}
            today={today}
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

interface FormCreditNoteLine {
  id?: string;
  invoiceLineId?: string;
  itemId?: string;
  itemSku?: string;
  itemName?: string;
  unitId?: string;
  concept: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

function CreditNoteFields({
  note,
  suppliers,
  invoices,
  today,
}: {
  note: SupplierCreditNote | null;
  suppliers: SupplierBalance['supplier'][];
  invoices: PayableInvoice[];
  today: string;
}) {
  const [selectedSupplier, setSelectedSupplier] = useState(note?.supplier.id ?? suppliers[0]?.id ?? '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(note?.invoice?.id ?? '');
  const [selectedReturnId, setSelectedReturnId] = useState(note?.purchaseReturnId ?? '');
  const [eligibleReturns, setEligibleReturns] = useState<EligiblePurchaseReturn[]>([]);
  const [reason, setReason] = useState<CreditNoteReason>(note?.reason ?? 'subsequent_discount');
  const [invoiceLines, setInvoiceLines] = useState<PurchaseInvoiceLine[]>([]);
  const [lines, setLines] = useState<FormCreditNoteLine[]>(
    note?.lines?.length
      ? note.lines.map((l) => ({
          id: l.id,
          invoiceLineId: l.invoiceLineId ?? undefined,
          itemId: l.itemId ?? undefined,
          itemSku: l.itemSku ?? undefined,
          itemName: l.itemName ?? undefined,
          unitId: l.unitId ?? undefined,
          concept: l.concept ?? '',
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          taxRate: String(l.taxRate),
        }))
      : [{ concept: 'Descuento posterior', quantity: '1', unitPrice: '0', taxRate: '0' }],
  );

  const availableInvoices = invoices.filter((inv) => inv.supplier.id === selectedSupplier);

  useEffect(() => {
    if (!selectedInvoiceId) return;
    let active = true;

    getPurchaseInvoice(selectedInvoiceId).then((inv) => {
      if (active && inv) {
        setInvoiceLines(inv.lines ?? []);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoiceId || !selectedSupplier) {
      return;
    }
    let active = true;

    getEligiblePurchaseReturns(selectedInvoiceId, selectedSupplier).then((returns) => {
      if (active) {
        setEligibleReturns(returns);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedInvoiceId, selectedSupplier]);

  const onSupplierChange = (newSupplier: string) => {
    setSelectedSupplier(newSupplier);
    setSelectedReturnId('');
    setEligibleReturns([]);
    const validInvoices = invoices.filter((inv) => inv.supplier.id === newSupplier);
    if (!validInvoices.some((inv) => inv.id === selectedInvoiceId)) {
      setSelectedInvoiceId('');
      setInvoiceLines([]);
      setLines((prev) => prev.map((l) => ({ ...l, invoiceLineId: undefined })));
    }
  };

  const onInvoiceChange = (newInvoiceId: string) => {
    setSelectedInvoiceId(newInvoiceId);
    setSelectedReturnId('');
    if (!newInvoiceId) {
      setInvoiceLines([]);
      setEligibleReturns([]);
    }
    setLines((prev) => prev.map((l) => ({ ...l, invoiceLineId: undefined })));
  };

  const onReturnChange = (newReturnId: string) => {
    setSelectedReturnId(newReturnId);
    if (!newReturnId) {
      setLines([
        {
          concept: selectedInvoiceId ? '' : 'Descuento posterior',
          quantity: '1',
          unitPrice: '0',
          taxRate: '0',
        },
      ]);
      return;
    }

    const ret = eligibleReturns.find((r) => r.id === newReturnId);
    if (ret && ret.lines.length > 0) {
      setReason('return');
      setLines(
        ret.lines.map((rl) => {
          const matchingInvoiceLine = rl.invoiceLineId
            ? invoiceLines.find((il) => il.id === rl.invoiceLineId)
            : invoiceLines.find((il) => il.receiptLineId && il.receiptLineId === rl.receiptLineId);
          const price = rl.invoicedUnitPrice ?? matchingInvoiceLine?.unitPrice ?? rl.unitCost;
          const invoiceLineId = rl.invoiceLineId ?? matchingInvoiceLine?.id ?? undefined;

          return {
            concept: rl.concept,
            quantity: String(rl.quantity),
            unitPrice: String(price),
            taxRate: String(matchingInvoiceLine?.taxRate ?? '0'),
            itemId: rl.itemId,
            itemSku: rl.itemSku,
            itemName: rl.itemName,
            unitId: rl.unitId,
            invoiceLineId,
          };
        }),
      );
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        concept: selectedInvoiceId ? '' : 'Descuento posterior',
        quantity: '1',
        unitPrice: '0',
        taxRate: '0',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-muted block text-xs font-medium">Proveedor</label>
        <select
          name="supplierId"
          value={selectedSupplier}
          onChange={(e) => onSupplierChange(e.target.value)}
          data-testid="credit-note-supplier"
          className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
          required
        >
          <option value="">Selecciona un proveedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-muted block text-xs font-medium">Factura afectada (opcional)</label>
        <select
          name="invoiceId"
          value={selectedInvoiceId}
          onChange={(e) => onInvoiceChange(e.target.value)}
          data-testid="credit-note-invoice"
          className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Sin factura asociada (cupo a favor)</option>
          {availableInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.code} (Saldo: {inv.currency} {formatAmount(inv.balance)})
            </option>
          ))}
        </select>
      </div>

      {selectedInvoiceId ? (
        <div>
          <label className="text-muted block text-xs font-medium">Devolución de compra (opcional)</label>
          <select
            name="purchaseReturnId"
            value={selectedReturnId}
            onChange={(e) => onReturnChange(e.target.value)}
            data-testid="purchase-return-select"
            className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Sin devolución (rebaja de precio directa)</option>
            {eligibleReturns.map((ret) => (
              <option key={ret.id} value={ret.id}>
                {ret.code} ({ret.date}) - {ret.lines.length} {ret.lines.length === 1 ? 'línea' : 'líneas'}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="purchaseReturnId" value="" />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted block text-xs font-medium">Fecha de emisión</label>
          <input
            type="date"
            name="date"
            defaultValue={note?.issueDate ?? today}
            max={today}
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
            {CREDIT_NOTE_REASONS.map((r) => (
              <option key={r} value={r}>
                {CREDIT_NOTE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reason === 'other' ? (
        <div>
          <label className="text-muted block text-xs font-medium">Detalle del motivo (requerido)</label>
          <input
            type="text"
            name="reasonDetail"
            defaultValue={note?.reasonDetail ?? ''}
            data-testid="credit-note-reason-detail"
            className="border-line bg-surface mt-1 w-full rounded-md border px-3 py-2 text-sm"
            required
          />
        </div>
      ) : null}

      <TextArea
        label="Observaciones"
        name="notes"
        defaultValue={note?.notes ?? ''}
        testId="credit-note-notes"
      />

      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Líneas</label>
          {!selectedReturnId ? (
            <button
              type="button"
              onClick={addLine}
              data-testid="credit-note-add-line"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              + Agregar línea
            </button>
          ) : null}
        </div>

        <div className="space-y-3" data-testid="credit-note-lines">
          {lines.map((line, index) => (
            <div key={index} className="border-line flex items-start gap-2 rounded-md border p-2 text-sm">
              <div className="flex-1 space-y-2">
                {selectedInvoiceId && !selectedReturnId ? (
                  <div>
                    <label className="text-muted block text-[10px] font-medium">Línea de factura</label>
                    <select
                      name="lineInvoiceLineId"
                      value={line.invoiceLineId ?? ''}
                      onChange={(e) => {
                        const chosenId = e.target.value;
                        const chosenLine = invoiceLines.find((il) => il.id === chosenId);
                        setLines((prev) =>
                          prev.map((item, i) => {
                            if (i !== index) return item;
                            if (!chosenLine) return { ...item, invoiceLineId: undefined };
                            return {
                              ...item,
                              invoiceLineId: chosenLine.id,
                              itemId: chosenLine.itemId ?? undefined,
                              itemSku: chosenLine.itemSku ?? undefined,
                              itemName: chosenLine.itemName ?? undefined,
                              unitId: chosenLine.unitId ?? undefined,
                              concept: chosenLine.itemName || chosenLine.concept || item.concept,
                              quantity: item.quantity === '0' || !item.quantity ? String(chosenLine.quantity) : item.quantity,
                              unitPrice: item.unitPrice === '0' || !item.unitPrice ? String(chosenLine.unitPrice) : item.unitPrice,
                              taxRate: String(chosenLine.taxRate),
                            };
                          }),
                        );
                      }}
                      data-testid={`credit-note-line-invoice-line-${index}`}
                      className="border-line bg-surface w-full rounded border px-2 py-1 text-xs"
                      required
                    >
                      <option value="">Selecciona línea de factura...</option>
                      {invoiceLines.map((il) => (
                        <option key={il.id} value={il.id}>
                          {il.itemSku ? `${il.itemSku} - ` : ''}
                          {il.itemName || il.concept || 'Línea'} (Cant: {il.quantity}, P.U: {formatAmount(il.unitPrice)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input type="hidden" name="lineInvoiceLineId" value={line.invoiceLineId ?? ''} />
                )}

                <input type="hidden" name="lineItemId" value={line.itemId ?? ''} />
                <input type="hidden" name="lineItemSku" value={line.itemSku ?? ''} />
                <input type="hidden" name="lineItemName" value={line.itemName ?? ''} />
                <input type="hidden" name="lineUnitId" value={line.unitId ?? ''} />

                <div>
                  <label className="text-muted block text-[10px]">Concepto o descripción</label>
                  <input
                    type="text"
                    name="lineConcept"
                    value={line.concept}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, concept: e.target.value } : item)),
                      )
                    }
                    placeholder="Concepto o descripción"
                    data-testid={`credit-note-line-concept-${index}`}
                    className="border-line bg-surface w-full rounded border px-2 py-1 text-xs"
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
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)),
                        )
                      }
                      data-testid={`credit-note-line-quantity-${index}`}
                      className="border-line bg-surface w-full rounded border px-2 py-1 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-muted block text-[10px]">Precio unitario</label>
                    <input
                      type="number"
                      step="any"
                      name="linePrice"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, unitPrice: e.target.value } : item)),
                        )
                      }
                      data-testid={`credit-note-line-price-${index}`}
                      className="border-line bg-surface w-full rounded border px-2 py-1 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-muted block text-[10px]">IVA (%)</label>
                    <select
                      name="lineTax"
                      value={line.taxRate}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, taxRate: e.target.value } : item)),
                        )
                      }
                      data-testid={`credit-note-line-tax-${index}`}
                      className="border-line bg-surface w-full rounded border px-2 py-1 text-xs"
                    >
                      <option value="0">0% (Exento)</option>
                      <option value="16">16% (General)</option>
                      <option value="8">8% (Reducido)</option>
                    </select>
                  </div>
                </div>
              </div>

              {lines.length > 1 && !selectedReturnId ? (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="text-muted hover:text-red-500 p-1 text-xs"
                  title="Eliminar línea"
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreditNoteFilters({
  search,
  suppliers,
  count,
}: {
  search: CreditNoteSearch;
  suppliers: SupplierBalance['supplier'][];
  count: number;
}) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (search.q) params.set('q', search.q);
    if (search.supplierId) params.set('proveedor', search.supplierId);
    if (search.status) params.set('estado', search.status);
    if (search.from) params.set('desde', search.from);
    if (search.to) params.set('hasta', search.to);
    params.set('pagina', String(page));
    return `/cuentas-por-pagar/notas-de-credito?${params.toString()}`;
  };

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="credit-note-filter">
        <Filter label="Buscar" htmlFor="credit-note-search">
          <input
            id="credit-note-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código o notas..."
            data-testid="credit-note-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {suppliers.length > 0 ? (
          <Filter label="Proveedor" htmlFor="credit-note-filter-supplier">
            <select
              id="credit-note-filter-supplier"
              name="proveedor"
              defaultValue={search.supplierId}
              data-testid="credit-note-filter-supplier"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
            <option value="">Todos los estados</option>
            <option value="draft">Borrador</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Anulada</option>
          </select>
        </Filter>

        <Filter label="Desde" htmlFor="credit-note-filter-from">
          <input
            id="credit-note-filter-from"
            type="date"
            name="desde"
            defaultValue={search.from}
            data-testid="credit-note-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Hasta" htmlFor="credit-note-filter-to">
          <input
            id="credit-note-filter-to"
            type="date"
            name="hasta"
            defaultValue={search.to}
            data-testid="credit-note-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <button
          type="submit"
          data-testid="credit-note-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm font-medium"
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
