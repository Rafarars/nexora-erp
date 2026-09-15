'use client';

import { useState } from 'react';
import { changeItemStatus, saveItem } from '@/app/(app)/inventario/actions';
import { Field, TextArea } from '@/sections/shared/field';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { formatNumber, selectableOptions } from '@/modules/catalog/domain/catalog';
import type { Category, MeasurementUnit, Tax } from '@/modules/catalog/domain/catalog';
import { ITEM_TYPE_LABELS, describeUnits } from '@/modules/inventory/domain/item';
import type { Item } from '@/modules/inventory/domain/item';

export function ItemsBoard({
  items,
  categories,
  taxes,
  units,
  ...permissions
}: {
  items: Item[];
  categories: Category[];
  taxes: Tax[];
  units: MeasurementUnit[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="item"
      title="Artículos"
      description="Productos y servicios. El SKU lo eliges tú; el código lo asigna el sistema."
      newLabel="Nuevo artículo"
      rows={items}
      rowKey={(item) => item.sku}
      columns={[
        {
          header: 'Artículo',
          cell: (item) => (
            <>
              <p className="font-medium">{item.name}</p>
              <p className="text-muted font-mono text-xs">{item.sku}</p>
            </>
          ),
        },
        { header: 'Tipo', cell: (item) => ITEM_TYPE_LABELS[item.type] },
        {
          header: 'Categoría',
          cell: (item) => <span data-testid={`item-category-${item.sku}`}>{item.category?.name ?? '—'}</span>,
        },
        {
          header: 'Impuesto',
          cell: (item) => (item.tax ? `${item.tax.name} (${formatNumber(item.tax.rate)} %)` : '—'),
        },
        {
          header: 'Unidades',
          cell: (item) => <span data-testid={`item-units-${item.sku}`}>{describeUnits(item.units)}</span>,
        },
      ]}
      renderFields={(item) => <ItemFields item={item} categories={categories} taxes={taxes} units={units} />}
      save={saveItem}
      changeStatus={changeItemStatus}
      {...permissions}
    />
  );
}

interface UnitRow {
  key: number;
  unitId: string;
  factor: string;
}

function ItemFields({
  item,
  categories,
  taxes,
  units,
}: {
  item: Item | null;
  categories: Category[];
  taxes: Tax[];
  units: MeasurementUnit[];
}) {
  const initial: UnitRow[] = item
    ? item.units.map((unit, index) => ({ key: index, unitId: unit.unitId, factor: formatNumber(unit.conversionFactor) }))
    : [{ key: 0, unitId: '', factor: '1' }];

  const [rows, setRows] = useState<UnitRow[]>(initial);
  const [base, setBase] = useState<string>(item?.units.find((unit) => unit.isBase)?.unitId ?? '');
  const [nextKey, setNextKey] = useState(initial.length);

  const unitOptions = selectableOptions(units).concat(
    // Las unidades inactivas que el articulo ya usa siguen elegibles solo en su fila.
    units.filter((unit) => !unit.isActive && item?.units.some((current) => current.unitId === unit.id)),
  );

  const update = (key: number, change: Partial<UnitRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  // Si la fila marcada como base cambia de unidad, la marca la sigue: si no, el
  // articulo se quedaria sin base y la persona no veria por que.
  // Y la primera unidad que se elige queda como base mientras no haya otra marcada.
  const changeUnit = (row: UnitRow, unitId: string) => {
    if ((row.unitId !== '' && row.unitId === base) || base === '') setBase(unitId);
    update(row.key, { unitId });
  };

  return (
    <>
      <Field label="SKU" name="sku" testId="item-sku" defaultValue={item?.sku} autoComplete="off" />
      <Field label="Nombre" name="name" testId="item-name" defaultValue={item?.name} autoComplete="off" />
      <TextArea label="Descripción" name="description" testId="item-description" defaultValue={item?.description ?? ''} />

      <Select label="Tipo" name="type" testId="item-type" defaultValue={item?.type ?? 'inventoried'}>
        <option value="inventoried">{ITEM_TYPE_LABELS.inventoried}</option>
        <option value="service">{ITEM_TYPE_LABELS.service}</option>
      </Select>

      <Select label="Categoría" name="categoryId" testId="item-category" defaultValue={item?.category?.id ?? ''}>
        <option value="">Sin categoría</option>
        {selectableOptions(categories, item?.category?.id).map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      <Select label="Impuesto" name="taxId" testId="item-tax" defaultValue={item?.tax?.id ?? ''}>
        <option value="">Sin impuesto</option>
        {selectableOptions(taxes, item?.tax?.id).map((tax) => (
          <option key={tax.id} value={tax.id}>
            {tax.name} ({formatNumber(tax.rate)} %)
          </option>
        ))}
      </Select>

      <fieldset className="space-y-2" data-testid="item-units-editor">
        <legend className="text-sm font-medium">Unidades</legend>
        <p className="text-muted text-xs">
          Marca la unidad base: en ella se guardará el stock. Las demás dicen cuántas unidades base contienen.
        </p>

        {rows.map((row, index) => (
          <div key={row.key} className="flex items-center gap-2" data-testid={`item-unit-row-${index}`}>
            <select
              name="unitId"
              value={row.unitId}
              onChange={(event) => changeUnit(row, event.target.value)}
              aria-label="Unidad"
              data-testid={`item-unit-${index}`}
              className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
            >
              <option value="">Elige una unidad</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>

            <input
              name="conversionFactor"
              value={row.unitId !== '' && row.unitId === base ? '1' : row.factor}
              onChange={(event) => update(row.key, { factor: event.target.value })}
              disabled={row.unitId !== '' && row.unitId === base}
              inputMode="decimal"
              aria-label="Factor de conversión"
              data-testid={`item-unit-factor-${index}`}
              className="border-line w-20 rounded-md border bg-transparent px-2 py-2 text-sm disabled:opacity-60"
            />
            {/* Un campo deshabilitado no viaja en el formulario: este lo reemplaza para
                que los factores sigan alineados con las unidades. */}
            {row.unitId !== '' && row.unitId === base ? <input type="hidden" name="conversionFactor" value="1" /> : null}

            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                name="baseUnit"
                value={row.unitId}
                checked={row.unitId !== '' && row.unitId === base}
                disabled={row.unitId === ''}
                onChange={() => setBase(row.unitId)}
                data-testid={`item-unit-base-${index}`}
              />
              Base
            </label>

            <button
              type="button"
              onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
              disabled={rows.length === 1}
              aria-label="Quitar unidad"
              data-testid={`item-unit-remove-${index}`}
              className="text-muted px-1 text-sm disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            setRows((current) => [...current, { key: nextKey, unitId: '', factor: '' }]);
            setNextKey((key) => key + 1);
          }}
          data-testid="item-unit-add"
          className="border-line rounded-md border px-2 py-1 text-xs"
        >
          Agregar unidad
        </button>
      </fieldset>
    </>
  );
}

function Select({
  label,
  name,
  testId,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  testId: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        data-testid={testId}
        className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
