'use client';

import { useActionState, useState } from 'react';
import { changeAdjustment, saveAdjustment } from '@/app/(app)/inventario/actions';
import { FormError, SubmitButton, TextArea } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { SlideOver } from '@/sections/shared/slide-over';
import { emptyState } from '@/shared/forms/form-state';
import type { FormState } from '@/shared/forms/form-state';
import { selectableOptions } from '@/modules/catalog/domain/catalog';
import type { Warehouse } from '@/modules/catalog/domain/catalog';
import type { Item } from '@/modules/inventory/domain/item';
import { STATUS_LABELS, availableActions, formatCost, formatQuantity, summarizeLines } from '@/modules/inventory/domain/inventory';
import type { Adjustment } from '@/modules/inventory/domain/inventory';
import { submitKeepingValues } from '@/shared/forms/submit-keeping-values';

export function AdjustmentsBoard({
  adjustments,
  items,
  warehouses,
  today,
  canCreate,
  canUpdate,
  canConfirm,
  canCancel,
}: {
  adjustments: Adjustment[];
  items: Item[];
  warehouses: Warehouse[];
  today: string;
  canCreate: boolean;
  canUpdate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [editing, setEditing] = useState<Adjustment | null>(null);
  const [creating, setCreating] = useState(false);
  const hasOptions = canUpdate || canConfirm || canCancel;
  const baseUnitOf = (itemId: string) => items.find((item) => item.id === itemId)?.units.find((unit) => unit.isBase)?.abbreviation ?? '';

  const [saveState, save, saving] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveAdjustment(previous, form);

    if (result.done) {
      setEditing(null);
      setCreating(false);
    }

    return result;
  }, emptyState);

  // Confirmar y anular comparten un estado que vive aqui: el menu se cierra al enviar.
  const [changeState, change] = useActionState(changeAdjustment, emptyState);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Ajustes</h2>
          <p className="text-muted mt-1 text-sm">
            Un borrador no mueve nada. Confirmar mueve la existencia; anular la devuelve con movimientos de contrapartida.
          </p>
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-testid="new-adjustment"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Nuevo ajuste
          </button>
        ) : null}
      </div>

      <FormError message={changeState.error} testId="adjustment-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="adjustments-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Bodega</th>
              <th className="px-4 py-2 font-medium">Líneas</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {hasOptions ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {adjustments.map((adjustment) => {
              const actions = availableActions(adjustment);
              const offered = {
                edit: canUpdate && actions.edit,
                confirm: canConfirm && actions.confirm,
                cancel: canCancel && actions.cancel,
              };

              return (
                <tr key={adjustment.id} className="border-line border-t align-top" data-testid={`adjustment-row-${adjustment.code}`}>
                  <td className="px-4 py-3 font-mono text-xs">{adjustment.code}</td>
                  <td className="px-4 py-3">{adjustment.date}</td>
                  <td className="px-4 py-3">{adjustment.warehouse.name}</td>
                  <td className="px-4 py-3">
                    <p data-testid={`adjustment-lines-${adjustment.code}`}>{summarizeLines(adjustment.lines, baseUnitOf)}</p>
                    {adjustment.notes ? <p className="text-muted text-xs">{adjustment.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3" data-testid={`adjustment-status-${adjustment.code}`}>
                    {STATUS_LABELS[adjustment.status]}
                  </td>
                  {hasOptions ? (
                    <td className="px-4 py-3 text-right">
                      {offered.edit || offered.confirm || offered.cancel ? (
                        <RowOptions testId={`adjustment-options-${adjustment.code}`}>
                          {(close) => (
                            <>
                              {offered.edit ? (
                                <MenuButton
                                  testId={`adjustment-edit-${adjustment.code}`}
                                  onClick={() => {
                                    close();
                                    setEditing(adjustment);
                                  }}
                                >
                                  Editar
                                </MenuButton>
                              ) : null}
                              {offered.confirm ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={adjustment.id} />
                                  <input type="hidden" name="extra" value="confirm" />
                                  <MenuButton type="submit" testId={`adjustment-confirm-${adjustment.code}`}>
                                    Confirmar
                                  </MenuButton>
                                </form>
                              ) : null}
                              {offered.cancel ? (
                                <form action={change} onSubmit={close}>
                                  <input type="hidden" name="id" value={adjustment.id} />
                                  <input type="hidden" name="extra" value="cancel" />
                                  <MenuButton type="submit" testId={`adjustment-cancel-${adjustment.code}`}>
                                    {adjustment.status === 'confirmed' ? 'Anular (revierte la existencia)' : 'Anular'}
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

            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-6 text-center" data-testid="adjustments-empty">
                  Todavía no hay ajustes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <SlideOver
        title={editing ? `Editar ${editing.code}` : 'Nuevo ajuste'}
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        testId="adjustment-panel"
      >
        <form onSubmit={submitKeepingValues(save)} className="space-y-4" key={editing?.id ?? 'new'}>
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <AdjustmentFields adjustment={editing} items={items} warehouses={warehouses} today={today} />
          <FormError message={saveState.error} testId="adjustment-error" />
          <SubmitButton pending={saving} testId="adjustment-submit">
            Guardar borrador
          </SubmitButton>
        </form>
      </SlideOver>
    </section>
  );
}

interface LineRow {
  key: number;
  itemId: string;
  unitId: string;
  direction: 'in' | 'out';
  quantity: string;
  cost: string;
}

function AdjustmentFields({
  adjustment,
  items,
  warehouses,
  today,
}: {
  adjustment: Adjustment | null;
  items: Item[];
  warehouses: Warehouse[];
  today: string;
}) {
  const stockable = items.filter((item) => item.type === 'inventoried');
  const initial: LineRow[] = adjustment
    ? adjustment.lines.map((line, index) => ({
        key: index,
        itemId: line.itemId,
        unitId: line.unitId,
        direction: line.direction,
        quantity: formatQuantity(line.quantity),
        cost: line.unitCost === null ? '' : formatCost(line.unitCost),
      }))
    : [{ key: 0, itemId: '', unitId: '', direction: 'in', quantity: '', cost: '' }];

  const [rows, setRows] = useState<LineRow[]>(initial);
  const [nextKey, setNextKey] = useState(initial.length);
  const update = (key: number, change: Partial<LineRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="warehouseId" className="text-sm font-medium">
          Bodega
        </label>
        <select
          id="warehouseId"
          name="warehouseId"
          defaultValue={adjustment?.warehouse.id ?? warehouses.find((w) => w.isDefault)?.id ?? ''}
          data-testid="adjustment-warehouse"
          className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
        >
          {selectableOptions(warehouses, adjustment?.warehouse.id).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="date" className="text-sm font-medium">
          Fecha
        </label>
        <input
          id="date"
          name="date"
          type="date"
          max={today}
          defaultValue={adjustment?.date ?? today}
          data-testid="adjustment-date"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <TextArea label="Notas" name="notes" testId="adjustment-notes" defaultValue={adjustment?.notes ?? ''} />

      <fieldset className="space-y-3" data-testid="adjustment-lines-editor">
        <legend className="text-sm font-medium">Líneas</legend>
        <p className="text-muted text-xs">
          El costo es por unidad de la línea y solo lo llevan las entradas; sin costo, la entrada se valora al promedio vigente.
        </p>

        {rows.map((row, index) => {
          const item = stockable.find((candidate) => candidate.id === row.itemId);

          return (
            <div key={row.key} className="border-line space-y-2 rounded-md border p-2" data-testid={`adjustment-line-${index}`}>
              <div className="flex gap-2">
                <select
                  name="lineItem"
                  value={row.itemId}
                  aria-label="Artículo"
                  data-testid={`adjustment-line-item-${index}`}
                  // Al cambiar de articulo se propone su unidad base: la de antes ya no aplica.
                  onChange={(event) => {
                    const chosen = stockable.find((candidate) => candidate.id === event.target.value);
                    update(row.key, { itemId: event.target.value, unitId: chosen?.units.find((u) => u.isBase)?.unitId ?? '' });
                  }}
                  className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
                >
                  <option value="">Elige un artículo</option>
                  {selectableOptions(stockable, row.itemId).map((candidate) => (
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
                  data-testid={`adjustment-line-remove-${index}`}
                  className="text-muted px-1 text-sm disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  name="lineDirection"
                  value={row.direction}
                  aria-label="Tipo"
                  data-testid={`adjustment-line-direction-${index}`}
                  onChange={(event) => update(row.key, { direction: event.target.value as 'in' | 'out' })}
                  className="border-line bg-background rounded-md border px-2 py-2 text-sm"
                >
                  <option value="in">Entrada</option>
                  <option value="out">Salida</option>
                </select>
                <input
                  name="lineQuantity"
                  value={row.quantity}
                  inputMode="decimal"
                  aria-label="Cantidad"
                  placeholder="Cantidad"
                  data-testid={`adjustment-line-quantity-${index}`}
                  onChange={(event) => update(row.key, { quantity: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm"
                />
                <select
                  name="lineUnit"
                  value={row.unitId}
                  aria-label="Unidad"
                  data-testid={`adjustment-line-unit-${index}`}
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
                  value={row.direction === 'in' ? row.cost : ''}
                  disabled={row.direction === 'out'}
                  inputMode="decimal"
                  aria-label="Costo"
                  placeholder={row.direction === 'in' ? 'Costo' : 'Al promedio'}
                  data-testid={`adjustment-line-cost-${index}`}
                  onChange={(event) => update(row.key, { cost: event.target.value })}
                  className="border-line w-24 rounded-md border bg-transparent px-2 py-2 text-sm disabled:opacity-60"
                />
                {/* Un campo deshabilitado no viaja: este mantiene alineadas las columnas. */}
                {row.direction === 'out' ? <input type="hidden" name="lineCost" value="" /> : null}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setRows((current) => [...current, { key: nextKey, itemId: '', unitId: '', direction: 'in', quantity: '', cost: '' }]);
            setNextKey((key) => key + 1);
          }}
          data-testid="adjustment-line-add"
          className="border-line rounded-md border px-2 py-1 text-xs"
        >
          Agregar línea
        </button>
      </fieldset>
    </>
  );
}

function MenuButton({
  children,
  testId,
  type = 'button',
  onClick,
}: {
  children: React.ReactNode;
  testId: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
    >
      {children}
    </button>
  );
}
