'use client';

import { useActionState, useState } from 'react';
import { changeOrder, saveOrder, saveReceipt } from '@/app/(app)/compras/actions';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { selectableOptions } from '@/modules/catalog/domain/catalog';
import type { Warehouse } from '@/modules/catalog/domain/catalog';
import type { Item } from '@/modules/inventory/domain/item';
import { formatCost, formatQuantity } from '@/modules/inventory/domain/inventory';
import { currencyOptions, formatRate, offersManualRate } from '@/modules/company/domain/company';
import type { Currency } from '@/modules/company/domain/company';
import { ORDER_STATUS_LABELS, formatAmount, orderActions, summarizeOrderLines } from '@/modules/purchasing/domain/purchasing';
import type { PurchaseOrder, Supplier } from '@/modules/purchasing/domain/purchasing';
import { DocumentRate } from '@/sections/shared/document-rate';
import { MenuButton } from './menu-button';
import { ReceiptFields } from './receipt-fields';

export function OrdersBoard({
  orders,
  suppliers,
  items,
  warehouses,
  currencies,
  baseCurrency,
  allowsRateOverride,
  today,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
  canReceive,
}: {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  items: Item[];
  warehouses: Warehouse[];
  currencies: Currency[];
  baseCurrency: string;
  allowsRateOverride: boolean;
  today: string;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canReceive: boolean;
}) {
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const hasOptions = canUpdate || canConfirm || canCancel || canReceive;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveOrder(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [receiveState, receive, receivingPending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveReceipt(previous, form);

    if (result.done) setReceiving(null);

    return result;
  }, emptyState);

  // Confirmar y anular comparten un estado que vive aqui: el menu se cierra al enviar.
  const [changeState, change] = useActionState(changeOrder, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Órdenes de compra</h2>
          <p className="text-muted mt-1 text-sm">
            Un borrador no promete nada. Confirmada, anuncia la mercancía en camino; cada entrada la va recibiendo.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-order"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nueva orden
          </button>
        ) : null}
      </div>

      <FormError message={changeState.error} testId="order-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="orders-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 font-medium">Líneas</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const actions = orderActions(order);
              const offered = {
                edit: canUpdate && actions.edit,
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
                receive: canReceive && actions.receive,
              };

              return (
                <tr key={order.id} className="border-line border-t align-top" data-testid={`order-row-${order.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{order.code}</p>
                    <p className="text-muted text-xs">{order.date}</p>
                  </td>
                  <td className="px-4 py-3">{order.supplier.name}</td>
                  <td className="px-4 py-3">{order.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <p data-testid={`order-lines-${order.code}`}>{summarizeOrderLines(order.lines)}</p>
                    {order.expectedDate ? <p className="text-muted text-xs">Llega {order.expectedDate}</p> : null}
                    {order.notes ? <p className="text-muted text-xs">{order.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right" data-testid={`order-total-${order.code}`}>
                    <p>
                      {order.currency} {formatAmount(order.totals.total)}
                    </p>
                    <p className="text-muted text-xs">IVA {formatAmount(order.totals.tax)}</p>
                    <DocumentRate document={order} amount={order.totals.total} testId={`order-rate-${order.code}`} />
                  </td>
                  <td className="px-4 py-3" data-testid={`order-status-${order.code}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`order-options-${order.code}`}>
                          {(close) => (
                            <>
                              {offered.receive ? (
                                <MenuButton
                                  testId={`order-receive-${order.code}`}
                                  onClick={() => {
                                    close();
                                    setReceiving(order);
                                  }}
                                >
                                  Recibir mercancía
                                </MenuButton>
                              ) : null}
                              {offered.edit ? (
                                <MenuButton
                                  testId={`order-edit-${order.code}`}
                                  onClick={() => {
                                    close();
                                    setEditing(order);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={order.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`order-confirm-${order.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={order.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`order-cancel-${order.code}`}>
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

            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="orders-empty">
                  Todavía no hay órdenes de compra.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nueva orden de compra'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="order-panel"
      >
        <form action={save} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <OrderFields
            order={editing}
            suppliers={suppliers}
            items={items}
            warehouses={warehouses}
            currencies={currencies}
            baseCurrency={baseCurrency}
            allowsRateOverride={allowsRateOverride}
            today={today}
          />
          <FormError message={saveState.error} testId="order-error" />
          <SubmitButton pending={saving} testId="order-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>

      <SlideOver title={receiving ? `Recibir ${receiving.code}` : ''} open={receiving !== null} onClose={() => setReceiving(null)} testId="receive-panel">
        {receiving ? (
          <form action={receive} className="space-y-4" key={receiving.id}>
            <p className="text-muted text-sm">
              Se guarda como borrador en Entradas: la existencia sube cuando se confirma.
            </p>
            <ReceiptFields order={receiving} receipt={null} today={today} baseCurrency={baseCurrency} allowsRateOverride={allowsRateOverride} />
            <FormError message={receiveState.error} testId="receive-error" />
            <SubmitButton pending={receivingPending} testId="receive-submit">
              Crear entrada
            </SubmitButton>
          </form>
        ) : null}
      </SlideOver>
    </section>
  );
}

interface LineRow {
  key: number;
  itemId: string;
  unitId: string;
  quantity: string;
  cost: string;
}

function OrderFields({
  order,
  suppliers,
  items,
  warehouses,
  currencies,
  baseCurrency,
  allowsRateOverride,
  today,
}: {
  order: PurchaseOrder | null;
  suppliers: Supplier[];
  items: Item[];
  warehouses: Warehouse[];
  currencies: Currency[];
  baseCurrency: string;
  allowsRateOverride: boolean;
  today: string;
}) {
  const [currency, setCurrency] = useState(order?.currency ?? baseCurrency);
  // Solo se compra lo que entra a una bodega.
  const purchasable = items.filter((item) => item.type === 'inventoried');
  const initial: LineRow[] = order
    ? order.lines.map((line, index) => ({
        key: index,
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: formatQuantity(line.quantity),
        cost: formatCost(line.unitCost),
      }))
    : [{ key: 0, itemId: '', unitId: '', quantity: '', cost: '' }];

  const [rows, setRows] = useState<LineRow[]>(initial);
  const [nextKey, setNextKey] = useState(initial.length);
  const update = (key: number, change: Partial<LineRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="supplierId" className="text-sm font-medium">
          Proveedor
        </label>
        <select
          id="supplierId"
          name="supplierId"
          defaultValue={order?.supplier.id ?? ''}
          data-testid="order-supplier"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Elige un proveedor</option>
          {selectableOptions(suppliers, order?.supplier.id).map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-warehouse" className="text-sm font-medium">
          Bodega de destino
        </label>
        <select
          id="order-warehouse"
          name="warehouseId"
          defaultValue={order?.warehouse.id ?? warehouses.find((w) => w.isDefault)?.id ?? ''}
          data-testid="order-warehouse"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          {selectableOptions(warehouses, order?.warehouse.id).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="order-date" className="text-sm font-medium">
            Fecha
          </label>
          <input
            id="order-date"
            name="date"
            type="date"
            max={today}
            defaultValue={order?.date ?? today}
            data-testid="order-date"
            className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="order-expected" className="text-sm font-medium">
            Llega <span className="text-muted font-normal">(opcional)</span>
          </label>
          <input
            id="order-expected"
            name="expectedDate"
            type="date"
            defaultValue={order?.expectedDate ?? ''}
            data-testid="order-expected-date"
            className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="order-currency" className="text-sm font-medium">
            Moneda
          </label>
          <select
            id="order-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            data-testid="order-currency"
            className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {currencyOptions(currencies, order?.currency, baseCurrency).map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} — {option.name}
              </option>
            ))}
          </select>
        </div>
        {offersManualRate(currency, baseCurrency, allowsRateOverride) ? (
          <div className="flex-1 space-y-1.5">
            <label htmlFor="order-exchange-rate" className="text-sm font-medium">
              Tasa en Bs. <span className="text-muted font-normal">(vacía: la del día)</span>
            </label>
            <input
              id="order-exchange-rate"
              name="exchangeRate"
              inputMode="decimal"
              placeholder="Automática"
              defaultValue={order?.manualExchangeRate && order.exchangeRate !== null ? formatRate(order.exchangeRate) : ''}
              data-testid="order-exchange-rate"
              className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      <TextArea label="Notas" name="notes" testId="order-notes" defaultValue={order?.notes ?? ''} />

      <fieldset className="space-y-3" data-testid="order-lines-editor">
        <legend className="text-sm font-medium">Líneas</legend>
        <p className="text-muted text-xs">El costo es por unidad de la línea, sin impuesto. El impuesto sale del artículo.</p>

        {rows.map((row, index) => {
          const item = purchasable.find((candidate) => candidate.id === row.itemId);

          return (
            <div key={row.key} className="border-line space-y-2 rounded-md border p-2" data-testid={`order-line-${index}`}>
              <div className="flex gap-2">
                <select
                  name="lineItem"
                  value={row.itemId}
                  aria-label="Artículo"
                  data-testid={`order-line-item-${index}`}
                  // Al cambiar de articulo se propone su unidad base: la de antes ya no aplica.
                  onChange={(event) => {
                    const chosen = purchasable.find((candidate) => candidate.id === event.target.value);
                    update(row.key, { itemId: event.target.value, unitId: chosen?.units.find((u) => u.isBase)?.unitId ?? '' });
                  }}
                  className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">Elige un artículo</option>
                  {selectableOptions(purchasable, row.itemId).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.sku} — {candidate.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Quitar línea"
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
                  data-testid={`order-line-remove-${index}`}
                  className="text-muted px-1 text-sm disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  name="lineQuantity"
                  value={row.quantity}
                  inputMode="decimal"
                  aria-label="Cantidad"
                  placeholder="Cantidad"
                  data-testid={`order-line-quantity-${index}`}
                  onChange={(event) => update(row.key, { quantity: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm"
                />
                <select
                  name="lineUnit"
                  value={row.unitId}
                  aria-label="Unidad"
                  data-testid={`order-line-unit-${index}`}
                  onChange={(event) => update(row.key, { unitId: event.target.value })}
                  className="border-line bg-background rounded-md border px-2 py-2 text-sm"
                >
                  {(item?.units ?? []).map((unit) => (
                    <option key={unit.unitId} value={unit.unitId}>
                      {unit.abbreviation}
                    </option>
                  ))}
                </select>
                <input
                  name="lineCost"
                  value={row.cost}
                  inputMode="decimal"
                  aria-label="Costo"
                  placeholder="Costo"
                  data-testid={`order-line-cost-${index}`}
                  onChange={(event) => update(row.key, { cost: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm"
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setRows((current) => [...current, { key: nextKey, itemId: '', unitId: '', quantity: '', cost: '' }]);
            setNextKey((key) => key + 1);
          }}
          data-testid="order-line-add"
          className="border-line rounded-md border px-2 py-1 text-xs"
        >
          Agregar línea
        </button>
      </fieldset>
    </>
  );
}
