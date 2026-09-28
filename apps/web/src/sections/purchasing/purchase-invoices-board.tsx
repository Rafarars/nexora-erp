'use client';

import { useActionState, useState } from 'react';
import { changePurchaseInvoice, getPurchaseInvoiceThreeWayMatchAction, savePurchaseInvoice } from '@/app/(app)/compras/actions';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import {
  PURCHASE_INVOICE_STATUS_LABELS,
  formatAmount,
  purchaseInvoiceActions,
} from '@/modules/purchasing/domain/purchasing';
import type {
  GoodsReceipt,
  PurchaseInvoice,
  Supplier,
  ThreeWayMatchResponse,
} from '@/modules/purchasing/domain/purchasing';
import { currencyOptions, formatRate, offersManualRate } from '@/modules/company/domain/company';
import type { Currency } from '@/modules/company/domain/company';
import { DocumentRate } from '@/sections/shared/document-rate';
import { Pager } from '@/sections/shared/filters';
import { useEditingDraft } from '@/shared/forms/use-editing-draft';

export interface PurchaseInvoiceSearch {
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

interface InvoiceLineFormItem {
  id: string;
  lineType: 'RECEIPT' | 'SERVICE' | 'EXPENSE';
  receiptLineId?: string | null;
  orderLineId?: string | null;
  itemId?: string | null;
  unitId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatExempt: boolean;
}

export function PurchaseInvoicesBoard({
  invoices,
  search,
  suppliers,
  receipts,
  currencies,
  baseCurrency,
  allowsRateOverride,
  today,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  invoices: PurchaseInvoice[];
  search: PurchaseInvoiceSearch;
  suppliers: Supplier[];
  receipts: GoodsReceipt[];
  currencies: Currency[];
  baseCurrency: string;
  allowsRateOverride: boolean;
  today: string;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const { editing, setEditing, draftKey } = useEditingDraft(invoices);
  const [creating, setCreating] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [currency, setCurrency] = useState<string>(baseCurrency);
  const [formLines, setFormLines] = useState<InvoiceLineFormItem[]>([]);
  const [showReceiptPicker, setShowReceiptPicker] = useState(false);

  const [matchingInvoice, setMatchingInvoice] = useState<PurchaseInvoice | null>(null);
  const [matchData, setMatchData] = useState<ThreeWayMatchResponse | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function openMatch(inv: PurchaseInvoice) {
    setMatchingInvoice(inv);
    setLoadingMatch(true);
    setMatchData(null);
    setMatchError(null);
    try {
      const data = await getPurchaseInvoiceThreeWayMatchAction(inv.id);
      setMatchData(data);
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : 'Error al obtener conciliación');
    } finally {
      setLoadingMatch(false);
    }
  }

  function closeMatch() {
    setMatchingInvoice(null);
    setMatchData(null);
    setMatchError(null);
  }

  const hasOptions = canUpdate || canConfirm || canCancel || true;

  function openCreate() {
    setEditing(null);
    setSelectedSupplierId(suppliers[0]?.id ?? '');
    setCurrency(baseCurrency);
    setFormLines([
      {
        id: '1',
        lineType: 'EXPENSE',
        description: 'Servicio / Gasto',
        quantity: 1,
        unitPrice: 0,
        vatRate: 16,
        vatExempt: false,
      },
    ]);
    setCreating(true);
  }

  function openEdit(inv: PurchaseInvoice) {
    setCreating(false);
    setSelectedSupplierId(inv.supplierId);
    setCurrency(inv.currency);
    setFormLines(
      inv.lines.map((line) => ({
        id: line.id,
        lineType: line.receiptLineId ? 'RECEIPT' : line.orderLineId ? 'SERVICE' : 'EXPENSE',
        receiptLineId: line.receiptLineId,
        orderLineId: line.orderLineId,
        itemId: line.itemId,
        unitId: line.unitId,
        description: line.itemName || line.concept || '',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.taxRate,
        vatExempt: line.taxRate === 0,
      })),
    );
    setEditing(inv);
  }

  function closePanel() {
    setCreating(false);
    setEditing(null);
    setFormLines([]);
    setShowReceiptPicker(false);
  }

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await savePurchaseInvoice(previous, form);
    if (result.done) closePanel();
    return result;
  }, emptyState);

  const [changeState, change] = useActionState(changePurchaseInvoice, emptyState);

  function addExpenseLine() {
    setFormLines((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        lineType: 'EXPENSE',
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatRate: 16,
        vatExempt: false,
      },
    ]);
  }

  function removeLine(index: number) {
    setFormLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<InvoiceLineFormItem>) {
    setFormLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addReceiptLines(receipt: GoodsReceipt) {
    const newLines: InvoiceLineFormItem[] = receipt.lines.map((line) => ({
      id: String(Date.now() + Math.random()),
      lineType: 'RECEIPT',
      receiptLineId: line.id,
      itemId: line.itemId,
      unitId: line.unitId,
      description: `${line.itemName} (${line.sku}) - Ent: ${receipt.code}`,
      quantity: line.quantity,
      unitPrice: line.unitCost,
      vatRate: 16,
      vatExempt: false,
    }));
    setFormLines((prev) => [...prev, ...newLines]);
    setShowReceiptPicker(false);
  }

  const supplierReceipts = receipts.filter(
    (r) => r.status === 'confirmed' && (!selectedSupplierId || r.supplier.id === selectedSupplierId),
  );

  const subtotal = formLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const vat = formLines.reduce((sum, l) => sum + (l.vatExempt ? 0 : l.quantity * l.unitPrice * (l.vatRate / 100)), 0);
  const total = subtotal + vat;

  const pageHref = (page: number) =>
    `/compras/facturas?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.supplierId ? { proveedor: search.supplierId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Facturas de compra</h2>
          <p className="text-muted mt-1 text-sm">
            Cuentas por pagar con registro fiscal (FCP), control de cupo contra entradas de mercancía y conciliación de costos.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            data-testid="new-purchase-invoice-button"
            className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Nueva factura
          </button>
        )}
      </div>

      <FormError message={changeState.error} testId="purchase-invoice-change-error" />

      <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm" data-testid="purchase-invoices-table">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Nº Factura Proveedor</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Emisión</th>
              <th className="px-4 py-2">Vencimiento</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Tasa / Bs.</th>
              <th className="px-4 py-2">Estado</th>
              {hasOptions && <th className="px-4 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={hasOptions ? 9 : 8} className="px-4 py-8 text-center text-neutral-500">
                  No hay facturas de compra registradas.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const actions = purchaseInvoiceActions(inv);
                const supplier = suppliers.find((s) => s.id === inv.supplierId);

                return (
                  <tr key={inv.id} className="hover:bg-neutral-50" data-testid={`invoice-row-${inv.id}`}>
                    <td className="px-4 py-2 font-mono font-medium text-neutral-900">{inv.code}</td>
                    <td className="px-4 py-2 font-mono text-neutral-700">
                      {inv.supplierInvoiceSeries ? `${inv.supplierInvoiceSeries}-` : ''}
                      {inv.supplierInvoiceNumber}
                    </td>
                    <td className="px-4 py-2 text-neutral-800">{supplier?.name ?? inv.supplierId}</td>
                    <td className="px-4 py-2 text-neutral-600">{inv.issueDate}</td>
                    <td className="px-4 py-2 text-neutral-600">{inv.dueDate}</td>
                    <td className="px-4 py-2 text-right font-medium text-neutral-900">
                      {formatAmount(inv.total)} {inv.currency}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600">
                      <DocumentRate document={inv} amount={inv.total} bolivars={inv.totalVes} testId={`invoice-rate-${inv.code}`} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          inv.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'cancelled'
                              ? 'bg-neutral-100 text-neutral-600'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {PURCHASE_INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    {hasOptions && (
                      <td className="px-4 py-2 text-right">
                        <RowOptions testId={`invoice-options-${inv.code}`}>
                          {(close) => (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  close();
                                  openMatch(inv);
                                }}
                                data-testid={`match-invoice-${inv.id}`}
                                className="block w-full px-3 py-1 text-left text-xs text-blue-700 hover:bg-blue-50"
                              >
                                Conciliación (3-Way)
                              </button>
                              {actions.edit && canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    close();
                                    openEdit(inv);
                                  }}
                                  data-testid={`edit-invoice-${inv.id}`}
                                  className="block w-full px-3 py-1 text-left text-xs text-neutral-700 hover:bg-neutral-100"
                                >
                                  Editar
                                </button>
                              )}
                              {actions.confirm && canConfirm && (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={inv.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <button
                                    type="submit"
                                    data-testid={`confirm-invoice-${inv.id}`}
                                    className="block w-full px-3 py-1 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                                  >
                                    Confirmar
                                  </button>
                                </form>
                              )}
                              {actions.cancel && canCancel && (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={inv.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <button
                                    type="submit"
                                    data-testid={`cancel-invoice-${inv.id}`}
                                    className="block w-full px-3 py-1 text-left text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Anular
                                  </button>
                                </form>
                              )}
                            </>
                          )}
                        </RowOptions>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pager
        testId="purchase-invoices"
        page={search.page}
        pageSize={search.pageSize}
        count={invoices.length}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />

      <SlideOver
        open={creating || Boolean(editing)}
        onClose={closePanel}
        title={editing ? `Editar factura ${editing.code}` : 'Nueva factura de compra'}
        testId="purchase-invoice-slideover"
      >
        <form key={draftKey('invoice')} action={save} className="space-y-4">
          <FormError message={saveState.error} testId="purchase-invoice-form-error" />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Proveedor</label>
            <select
              name="supplierId"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              disabled={Boolean(editing)}
              data-testid="invoice-supplier-select"
              className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
              required
            >
              {supplierOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Nº Factura</label>
              <input
                type="text"
                name="invoiceNumber"
                defaultValue={editing?.supplierInvoiceNumber ?? ''}
                placeholder="000123"
                data-testid="supplier-invoice-number-input"
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Serie (opcional)</label>
              <input
                type="text"
                name="series"
                defaultValue={editing?.supplierInvoiceSeries ?? ''}
                placeholder="A"
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Control (opcional)</label>
              <input
                type="text"
                name="controlNumber"
                placeholder="00-001234"
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Fecha de Emisión</label>
              <input
                type="date"
                name="issuedAt"
                defaultValue={editing?.issueDate ?? today}
                data-testid="invoice-issue-date-input"
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Fecha de Vencimiento</label>
              <input
                type="date"
                name="dueAt"
                defaultValue={editing?.dueDate ?? today}
                data-testid="invoice-due-date-input"
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-neutral-700">Moneda</label>
              <select
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
              >
                {currencyOptions(currencies, editing?.currency, baseCurrency).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </select>
            </div>
            {offersManualRate(currency, baseCurrency, allowsRateOverride) && (
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-neutral-700">
                  Tasa en Bs. <span className="font-normal text-neutral-500">(vacía: la del día)</span>
                </label>
                <input
                  name="exchangeRate"
                  inputMode="decimal"
                  placeholder="Automática"
                  defaultValue={editing?.manualExchangeRate && editing.exchangeRate !== null ? formatRate(editing.exchangeRate) : ''}
                  data-testid="invoice-exchange-rate"
                  className="mt-1 block w-full rounded border border-neutral-300 p-2 text-sm"
                />
              </div>
            )}
          </div>

          <TextArea label="Notas" name="notes" testId="invoice-notes" defaultValue={editing?.notes ?? ''} />

          <div className="border-t border-neutral-200 pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-800">Líneas de la factura</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptPicker(true)}
                  data-testid="load-from-receipt-button"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cargar desde entrada
                </button>
                <button
                  type="button"
                  onClick={addExpenseLine}
                  data-testid="add-expense-line-button"
                  className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  + Gasto/Concepto
                </button>
              </div>
            </div>

            {showReceiptPicker && (
              <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-xs">
                <p className="font-semibold text-blue-900">Seleccionar entrada de mercancía confirmada:</p>
                {supplierReceipts.length === 0 ? (
                  <p className="mt-1 text-blue-700">No hay entradas confirmadas para este proveedor.</p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {supplierReceipts.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded bg-white p-1.5 shadow-xs hover:bg-blue-100"
                      >
                        <span>
                          <strong className="font-mono">{r.code}</strong> ({r.date}) - {r.lines.length} líneas
                        </span>
                        <button
                          type="button"
                          onClick={() => addReceiptLines(r)}
                          data-testid={`pick-receipt-${r.id}`}
                          className="rounded bg-blue-600 px-2 py-0.5 font-medium text-white hover:bg-blue-700"
                        >
                          Cargar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowReceiptPicker(false)}
                  className="mt-2 text-xs text-neutral-600 underline"
                >
                  Cerrar
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {formLines.map((line, index) => (
                <div key={line.id} className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">
                  <input type="hidden" name="lineType" value={line.lineType} />
                  <input type="hidden" name="receiptLineId" value={line.receiptLineId ?? ''} />
                  <input type="hidden" name="orderLineId" value={line.orderLineId ?? ''} />
                  <input type="hidden" name="itemId" value={line.itemId ?? ''} />
                  <input type="hidden" name="unitId" value={line.unitId ?? ''} />
                  <input type="hidden" name="lineVatExempt" value={String(line.vatExempt)} />

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-700">
                      #{index + 1} [{line.lineType}]
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="mt-1">
                    <label className="block text-[10px] text-neutral-500">Descripción / Concepto</label>
                    <input
                      type="text"
                      name="lineDescription"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Concepto o descripción..."
                      className="mt-0.5 block w-full rounded border border-neutral-300 bg-white p-1 text-xs"
                      required
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-neutral-500">Cantidad</label>
                      <input
                        type="number"
                        name="lineQuantity"
                        step="0.0001"
                        min="0.0001"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                        data-testid={`line-qty-${index}`}
                        className="mt-0.5 block w-full rounded border border-neutral-300 bg-white p-1 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500">Precio Unitario</label>
                      <input
                        type="number"
                        name="lineUnitPrice"
                        step="0.01"
                        min="0"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                        data-testid={`line-price-${index}`}
                        className="mt-0.5 block w-full rounded border border-neutral-300 bg-white p-1 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500">% IVA</label>
                      <select
                        name="lineVatRate"
                        value={line.vatRate}
                        onChange={(e) => updateLine(index, { vatRate: Number(e.target.value), vatExempt: Number(e.target.value) === 0 })}
                        className="mt-0.5 block w-full rounded border border-neutral-300 bg-white p-1 text-xs"
                      >
                        <option value="16">16% (General)</option>
                        <option value="8">8% (Reducido)</option>
                        <option value="0">0% (Exento)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500">Subtotal</label>
                      <div className="mt-1 font-mono text-xs font-semibold text-neutral-900">
                        {formatAmount(line.quantity * line.unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded bg-neutral-100 p-3 text-right text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-600">Base Imponible:</span>
                <span className="font-mono font-medium">{formatAmount(subtotal)} {currency}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-600">IVA:</span>
                <span className="font-mono font-medium">{formatAmount(vat)} {currency}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-300 py-1 text-sm font-bold text-neutral-900">
                <span>Total Factura:</span>
                <span className="font-mono">{formatAmount(total)} {currency}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton pending={saving} testId="save-purchase-invoice-button">
              {editing ? 'Guardar cambios' : 'Guardar borrador'}
            </SubmitButton>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={Boolean(matchingInvoice)}
        onClose={closeMatch}
        title={matchingInvoice ? `Conciliación a 3 bandas — ${matchingInvoice.code}` : ''}
        testId="three-way-match-modal"
      >
        {loadingMatch && (
          <div className="py-8 text-center text-sm text-neutral-500" data-testid="match-loading">
            Cargando conciliación...
          </div>
        )}
        {matchError && (
          <div className="rounded bg-red-50 p-3 text-xs text-red-700" data-testid="match-error">
            {matchError}
          </div>
        )}
        {matchData && (
          <div className="space-y-4">
            {matchData.hasQuantityExceeded && (
              <div
                className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800"
                data-testid="match-qty-exceeded-alert"
              >
                <strong>Exceso de cantidad:</strong> Esta factura excede las cantidades disponibles en las entradas recibidas. No podrá ser confirmada mientras persista el exceso.
              </div>
            )}
            {matchData.totalPriceDifference !== 0 && (
              <div
                className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800"
                data-testid="match-price-diff-alert"
              >
                <strong>Diferencia de costo/precio:</strong> Se detectaron diferencias en los precios unitarios respecto a las órdenes o entradas (Diferencia total: {formatAmount(matchData.totalPriceDifference)} {matchingInvoice?.currency}).
              </div>
            )}
            {!matchData.hasDiscrepancies && (
              <div
                className="rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800"
                data-testid="match-exact-alert"
              >
                <strong>Conciliación exacta:</strong> Todas las cantidades y costos coinciden con las órdenes y recepciones correspondientes.
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Detalle por línea
              </h4>
              <div className="space-y-2" data-testid="three-way-match-lines">
                {matchData.lines.map((l) => (
                  <div key={l.invoiceLineId} className="rounded border border-neutral-200 bg-neutral-50 p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-neutral-900">
                          #{l.lineNumber} {l.itemName || l.concept || 'Línea'}
                        </span>
                        {l.itemSku && <span className="ml-1 text-neutral-500">({l.itemSku})</span>}
                        {l.receiptCode && (
                          <div className="text-[11px] text-blue-600">
                            Entrada: {l.receiptCode}
                          </div>
                        )}
                        {l.orderCode && (
                          <div className="text-[11px] text-neutral-500">
                            Orden: {l.orderCode}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {l.quantityMismatch ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            Exceso cant.
                          </span>
                        ) : l.priceMismatch ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            Dif. precio
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Correcto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-neutral-200 pt-2 text-[11px]">
                      <div>
                        <span className="text-neutral-500">Cant. Facturada:</span>{' '}
                        <strong className="font-mono">{l.invoicedQuantity}</strong>
                        {l.availableQuantity !== null && (
                          <div className="text-neutral-500">
                            Disponible entrada: <span className="font-mono">{l.availableQuantity}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-neutral-500">Precio Factura:</span>{' '}
                        <strong className="font-mono">{formatAmount(l.invoiceUnitPrice)}</strong>
                        {l.receiptUnitCost !== null && (
                          <div className="text-neutral-500">
                            Costo Entrada: <span className="font-mono">{formatAmount(l.receiptUnitCost)}</span>
                          </div>
                        )}
                        {l.priceDifference !== 0 && (
                          <div className={l.priceDifference > 0 ? 'text-amber-700' : 'text-blue-700'}>
                            Dif: <span className="font-mono">{formatAmount(l.priceDifference)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={closeMatch}
                className="w-full rounded border border-neutral-300 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </SlideOver>
    </section>
  );
}
