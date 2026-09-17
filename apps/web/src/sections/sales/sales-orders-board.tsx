'use client';

import { useActionState, useState } from 'react';
import { changeOrder, saveDispatch, saveOrder } from '@/app/(app)/ventas/actions';
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
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { DocumentRate } from '@/sections/shared/document-rate';
import { ORDER_STATUS_LABELS, orderActions, summarizeOrderLines } from '@/modules/sales/domain/sales';
import type { Customer, SalesOrder } from '@/modules/sales/domain/sales';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { DispatchFields } from './dispatch-fields';

export function SalesOrdersBoard({
  orders,
  customers,
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
  canDispatch,
}: {
  orders: SalesOrder[];
  customers: Customer[];
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
  canDispatch: boolean;
}) {
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [dispatching, setDispatching] = useState<SalesOrder | null>(null);
  const hasOptions = canUpdate || canConfirm || canCancel || canDispatch;

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveOrder(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  const [dispatchState, dispatchOrder, dispatchingPending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveDispatch(previous, form);

    if (result.done) setDispatching(null);

    return result;
  }, emptyState);

  // Confirmar y anular comparten un estado que vive aqui: el menu se cierra al enviar.
  const [changeState, change] = useActionState(changeOrder, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Pedidos de venta</h2>
          <p className="text-muted mt-1 text-sm">
            Un borrador no reserva nada. Confirmado, reserva la existencia; cada despacho la saca de la bodega.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-sales-order"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nuevo pedido
          </button>
        ) : null}
      </div>

      <FormError message={changeState.error} testId="sales-order-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="sales-orders-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
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
                dispatch: canDispatch && actions.dispatch,
              };

              return (
                <tr key={order.id} className="border-line border-t align-top" data-testid={`sales-order-row-${order.code}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{order.code}</p>
                    <p className="text-muted text-xs">{order.date}</p>
                  </td>
                  <td className="px-4 py-3">{order.customer.name}</td>
                  <td className="px-4 py-3">{order.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <p data-testid={`sales-order-lines-${order.code}`}>{summarizeOrderLines(order.lines)}</p>
                    
                    {order.notes ? <p className="text-muted text-xs">{order.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right" data-testid={`sales-order-total-${order.code}`}>
                    <p>
                      {order.currency} {formatAmount(order.totals.total)}
                    </p>
                    <p className="text-muted text-xs">IVA {formatAmount(order.totals.tax)}</p>
                    <DocumentRate document={order} amount={order.totals.total} testId={`sales-order-rate-${order.code}`} />
                  </td>
                  <td className="px-4 py-3" data-testid={`sales-order-status-${order.code}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {Object.values(offered).some(Boolean) ? (
                        <RowOptions testId={`sales-order-options-${order.code}`}>
                          {(close) => (
                            <>
                              {offered.dispatch ? (
                                <MenuButton
                                  testId={`sales-order-dispatch-${order.code}`}
                                  onClick={() => {
                                    close();
                                    setDispatching(order);
                                  }}
                                >
                                  Despachar
                                </MenuButton>
                              ) : null}
                              {offered.edit ? (
                                <MenuButton
                                  testId={`sales-order-edit-${order.code}`}
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
                                  <MenuButton type="submit" testId={`sales-order-confirm-${order.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={order.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`sales-order-cancel-${order.code}`}>
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
                <td colSpan={7} className="text-muted px-4 py-6 text-center" data-testid="sales-orders-empty">
                  Todavía no hay pedidos de venta.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nuevo pedido de compra'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="sales-order-panel"
      >
        <form action={save} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <OrderFields
            order={editing}
            customers={customers}
            items={items}
            warehouses={warehouses}
            currencies={currencies}
            baseCurrency={baseCurrency}
            allowsRateOverride={allowsRateOverride}
            today={today}
          />
          <FormError message={saveState.error} testId="sales-order-error" />
          <SubmitButton pending={saving} testId="sales-order-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>

      <SlideOver title={dispatching ? `Despachar ${dispatching.code}` : ''} open={dispatching !== null} onClose={() => setDispatching(null)} testId="dispatch-panel">
        {dispatching ? (
          <form action={dispatchOrder} className="space-y-4" key={dispatching.id}>
            <p className="text-muted text-sm">
              Se guarda como borrador en Despachos: la existencia baja cuando se confirma.
            </p>
            <DispatchFields order={dispatching} dispatch={null} today={today} />
            <FormError message={dispatchState.error} testId="dispatch-error" />
            <SubmitButton pending={dispatchingPending} testId="dispatch-submit">
              Crear despacho
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
  price: string;
}

function OrderFields({
  order,
  customers,
  items,
  warehouses,
  currencies,
  baseCurrency,
  allowsRateOverride,
  today,
}: {
  order: SalesOrder | null;
  customers: Customer[];
  items: Item[];
  warehouses: Warehouse[];
  currencies: Currency[];
  baseCurrency: string;
  allowsRateOverride: boolean;
  today: string;
}) {
  const [currency, setCurrency] = useState(order?.currency ?? baseCurrency);
  // Solo se vende lo que sale de una bodega.
  const sellable = items.filter((item) => item.type === 'inventoried');
  const initial: LineRow[] = order
    ? order.lines.map((line, index) => ({
        key: index,
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: formatQuantity(line.quantity),
        price: formatCost(line.unitPrice),
      }))
    : [{ key: 0, itemId: '', unitId: '', quantity: '', price: '' }];

  const [rows, setRows] = useState<LineRow[]>(initial);
  const [nextKey, setNextKey] = useState(initial.length);
  const update = (key: number, change: Partial<LineRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="customerId" className="text-sm font-medium">
          Cliente
        </label>
        <select
          id="customerId"
          name="customerId"
          defaultValue={order?.customer.id ?? ''}
          data-testid="sales-order-customer"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Elige un cliente</option>
          {selectableOptions(customers, order?.customer.id).map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="order-warehouse" className="text-sm font-medium">
          Bodega de salida
        </label>
        <select
          id="order-warehouse"
          name="warehouseId"
          defaultValue={order?.warehouse.id ?? warehouses.find((w) => w.isDefault)?.id ?? ''}
          data-testid="sales-order-warehouse"
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
            data-testid="sales-order-date"
            className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="sales-order-currency" className="text-sm font-medium">
            Moneda
          </label>
          <select
            id="sales-order-currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            data-testid="sales-order-currency"
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
            <label htmlFor="sales-order-exchange-rate" className="text-sm font-medium">
              Tasa en Bs. <span className="text-muted font-normal">(vacía: la del día)</span>
            </label>
            <input
              id="sales-order-exchange-rate"
              name="exchangeRate"
              inputMode="decimal"
              placeholder="Automática"
              defaultValue={order?.manualExchangeRate && order.exchangeRate !== null ? formatRate(order.exchangeRate) : ''}
              data-testid="sales-order-exchange-rate"
              className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      <TextArea label="Notas" name="notes" testId="sales-order-notes" defaultValue={order?.notes ?? ''} />

      <fieldset className="space-y-3" data-testid="sales-sales-order-lines-editor">
        <legend className="text-sm font-medium">Líneas</legend>
        <p className="text-muted text-xs">El precio es por unidad de la línea, sin impuesto. El impuesto sale del artículo.</p>

        {rows.map((row, index) => {
          const item = sellable.find((candidate) => candidate.id === row.itemId);

          return (
            <div key={row.key} className="border-line space-y-2 rounded-md border p-2" data-testid={`sales-order-line-${index}`}>
              <div className="flex gap-2">
                <select
                  name="lineItem"
                  value={row.itemId}
                  aria-label="Artículo"
                  data-testid={`sales-order-line-item-${index}`}
                  // Al cambiar de articulo se propone su unidad base: la de antes ya no aplica.
                  onChange={(event) => {
                    const chosen = sellable.find((candidate) => candidate.id === event.target.value);
                    update(row.key, { itemId: event.target.value, unitId: chosen?.units.find((u) => u.isBase)?.unitId ?? '' });
                  }}
                  className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">Elige un artículo</option>
                  {selectableOptions(sellable, row.itemId).map((candidate) => (
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
                  data-testid={`sales-order-line-remove-${index}`}
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
                  data-testid={`sales-order-line-quantity-${index}`}
                  onChange={(event) => update(row.key, { quantity: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm"
                />
                <select
                  name="lineUnit"
                  value={row.unitId}
                  aria-label="Unidad"
                  data-testid={`sales-order-line-unit-${index}`}
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
                  name="linePrice"
                  value={row.price}
                  inputMode="decimal"
                  aria-label="Precio"
                  placeholder="Precio"
                  data-testid={`sales-order-line-price-${index}`}
                  onChange={(event) => update(row.key, { price: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm"
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setRows((current) => [...current, { key: nextKey, itemId: '', unitId: '', quantity: '', price: '' }]);
            setNextKey((key) => key + 1);
          }}
          data-testid="sales-order-line-add"
          className="border-line rounded-md border px-2 py-1 text-xs"
        >
          Agregar línea
        </button>
      </fieldset>
    </>
  );
}
