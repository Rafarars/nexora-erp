'use client';

import Link from 'next/link';

import { useState } from 'react';
import { changeItemStatus, saveItem } from '@/app/(app)/inventario/actions';
import { Field, TextArea } from '@/sections/shared/field';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { formatNumber, selectableOptions } from '@/modules/catalog/domain/catalog';
import type { Category, MeasurementUnit, PriceList, Tax, Warehouse } from '@/modules/catalog/domain/catalog';
import { ITEM_TYPE_LABELS, describePrices, describeUnits } from '@/modules/inventory/domain/item';
import type { Item } from '@/modules/inventory/domain/item';

// Cada impuesto con su porcentaje; sin impuesto, la linea no lleva ninguno.
function describeTax(tax: Item['salesTax']): string {
  return tax ? `${tax.name} (${formatNumber(tax.rate)} %)` : '—';
}

export function ItemsBoard({
  items,
  categories,
  taxes,
  units,
  warehouses,
  priceLists,
  search,
  ...permissions
}: {
  items: Item[];
  warehouses: Warehouse[];
  priceLists: PriceList[];
  search: { q: string; page: number; pageSize: number; total: number; hasMore: boolean };
  categories: Category[];
  taxes: Tax[];
  units: MeasurementUnit[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <div className="space-y-4">
      <ItemSearch search={search} />

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
          header: 'Se usa para',
          cell: (item) => (
            <span data-testid={`item-trade-${item.sku}`}>
              {[item.isPurchasable ? 'Comprar' : null, item.isSellable ? 'Vender' : null].filter(Boolean).join(' · ') || '—'}
            </span>
          ),
        },
        {
          header: 'Impuestos',
          cell: (item) => (
            <span data-testid={`item-taxes-${item.sku}`}>
              Venta: {describeTax(item.salesTax)} · Compra: {describeTax(item.purchaseTax)}
            </span>
          ),
        },
        {
          header: 'Precios',
          cell: (item) => <span data-testid={`item-prices-${item.sku}`}>{describePrices(item)}</span>,
        },
        {
          header: 'Unidades',
          cell: (item) => <span data-testid={`item-units-${item.sku}`}>{describeUnits(item.units)}</span>,
        },
      ]}
      renderFields={(item) => (
        <ItemFields item={item} categories={categories} taxes={taxes} units={units} warehouses={warehouses} priceLists={priceLists} />
      )}
      save={saveItem}
        changeStatus={changeItemStatus}
        {...permissions}
      />
    </div>
  );
}

// Buscar y pasar de pagina por la URL: la pantalla se puede compartir y el navegador vuelve atras.
function ItemSearch({ search }: { search: { q: string; page: number; pageSize: number; total: number; hasMore: boolean } }) {
  const from = search.total === 0 ? 0 : (search.page - 1) * search.pageSize + 1;
  const to = (search.page - 1) * search.pageSize + Math.min(search.pageSize, Math.max(0, search.total - (search.page - 1) * search.pageSize));
  const pageHref = (page: number) => `/inventario/articulos?${new URLSearchParams({ ...(search.q ? { q: search.q } : {}), ...(page > 1 ? { pagina: String(page) } : {}) }).toString()}`;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form method="get" className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="item-search" className="text-sm font-medium">
            Buscar
          </label>
          <input
            id="item-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código, SKU, nombre o código de barras"
            data-testid="item-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" data-testid="item-search-submit" className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm">
          Buscar
        </button>
      </form>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted" data-testid="item-page-range">
          {from}–{to} de {search.total}
        </span>
        {search.page > 1 ? (
          <Link href={pageHref(search.page - 1)} data-testid="item-page-previous" className="border-line hover:bg-surface rounded-md border px-3 py-2">
            Anterior
          </Link>
        ) : null}
        {search.hasMore ? (
          <Link href={pageHref(search.page + 1)} data-testid="item-page-next" className="border-line hover:bg-surface rounded-md border px-3 py-2">
            Siguiente
          </Link>
        ) : null}
      </div>
    </div>
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
  warehouses,
  priceLists,
}: {
  item: Item | null;
  categories: Category[];
  taxes: Tax[];
  units: MeasurementUnit[];
  warehouses: Warehouse[];
  priceLists: PriceList[];
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
      <Field label="Código de barras" name="barcode" testId="item-barcode" required={false} defaultValue={item?.barcode ?? ''} autoComplete="off" />

      {/* Un insumo puede existir solo para comprarlo, y un servicio propio solo para venderlo. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Se usa para</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPurchasable" defaultChecked={item?.isPurchasable ?? true} data-testid="item-purchasable" />
          Comprar
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isSellable" defaultChecked={item?.isSellable ?? true} data-testid="item-sellable" />
          Vender
        </label>
      </fieldset>
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

      <Select label="Impuesto al vender" name="salesTaxId" testId="item-sales-tax" defaultValue={item?.salesTax?.id ?? ''}>
        <option value="">Sin impuesto</option>
        {selectableOptions(taxes, item?.salesTax?.id).map((tax) => (
          <option key={tax.id} value={tax.id}>
            {tax.name} ({formatNumber(tax.rate)} %)
          </option>
        ))}
      </Select>

      {/* Un articulo puede comprarse exento y venderse con IVA. */}
      <Select label="Impuesto al comprar" name="purchaseTaxId" testId="item-purchase-tax" defaultValue={item?.purchaseTax?.id ?? ''}>
        <option value="">Sin impuesto</option>
        {selectableOptions(taxes, item?.purchaseTax?.id).map((tax) => (
          <option key={tax.id} value={tax.id}>
            {tax.name} ({formatNumber(tax.rate)} %)
          </option>
        ))}
      </Select>

      <ReorderRulesEditor item={item} warehouses={warehouses} />

      <PricesEditor item={item} priceLists={priceLists} />

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

interface RuleRow {
  key: number;
  warehouseId: string;
  min: string;
  max: string;
  quantity: string;
}

// Cuanto se quiere tener del articulo en cada bodega. Sin filas, el articulo no se vigila.
function ReorderRulesEditor({ item, warehouses }: { item: Item | null; warehouses: Warehouse[] }) {
  const initial: RuleRow[] = (item?.reorderRules ?? []).map((rule, index) => ({
    key: index,
    warehouseId: rule.warehouse.id,
    min: formatNumber(rule.minQuantity),
    max: rule.maxQuantity === null ? '' : formatNumber(rule.maxQuantity),
    quantity: rule.reorderQuantity === 0 ? '' : formatNumber(rule.reorderQuantity),
  }));

  const [rows, setRows] = useState<RuleRow[]>(initial);
  const [nextKey, setNextKey] = useState(initial.length);

  const update = (key: number, change: Partial<RuleRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <fieldset className="space-y-2" data-testid="item-rules-editor">
      <legend className="text-sm font-medium">Mínimos por bodega</legend>
      <p className="text-muted text-xs">
        Por debajo del mínimo, el artículo aparece en «Bajo mínimo». «Pedir» es lo que se sugiere reponer; vacío,
        se sugiere llegar al máximo.
      </p>

      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2" data-testid={`item-rule-row-${index}`}>
          <select
            name="ruleWarehouse"
            value={row.warehouseId}
            onChange={(event) => update(row.key, { warehouseId: event.target.value })}
            aria-label="Bodega"
            data-testid={`item-rule-warehouse-${index}`}
            className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Elige una bodega</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <input
            name="ruleMin"
            value={row.min}
            onChange={(event) => update(row.key, { min: event.target.value })}
            aria-label="Mínimo"
            placeholder="Mínimo"
            data-testid={`item-rule-min-${index}`}
            className="border-line bg-background w-24 rounded-md border px-2 py-2 text-sm"
          />
          <input
            name="ruleMax"
            value={row.max}
            onChange={(event) => update(row.key, { max: event.target.value })}
            aria-label="Máximo"
            placeholder="Máximo"
            data-testid={`item-rule-max-${index}`}
            className="border-line bg-background w-24 rounded-md border px-2 py-2 text-sm"
          />
          <input
            name="ruleQuantity"
            value={row.quantity}
            onChange={(event) => update(row.key, { quantity: event.target.value })}
            aria-label="Pedir"
            placeholder="Pedir"
            data-testid={`item-rule-quantity-${index}`}
            className="border-line bg-background w-24 rounded-md border px-2 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
            data-testid={`item-rule-remove-${index}`}
            className="border-line hover:bg-surface rounded-md border px-2 py-2 text-sm"
          >
            Quitar
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, warehouseId: '', min: '', max: '', quantity: '' }]);
          setNextKey((key) => key + 1);
        }}
        data-testid="item-rule-add"
        className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
      >
        Agregar bodega
      </button>
    </fieldset>
  );
}


interface PriceRow {
  key: number;
  priceListId: string;
  price: string;
}

// Un precio por lista, en la unidad base del articulo. Al venderlo en otra unidad, el pedido lo
// multiplica por el factor de conversion.
function PricesEditor({ item, priceLists }: { item: Item | null; priceLists: PriceList[] }) {
  const initial: PriceRow[] = (item?.prices ?? []).map((price, index) => ({
    key: index,
    priceListId: price.priceList.id,
    price: formatNumber(price.price),
  }));

  const [rows, setRows] = useState<PriceRow[]>(initial);
  const [nextKey, setNextKey] = useState(initial.length);

  const update = (key: number, change: Partial<PriceRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));

  return (
    <fieldset className="space-y-2" data-testid="item-prices-editor">
      <legend className="text-sm font-medium">Precios de venta</legend>
      <p className="text-muted text-xs">
        El precio de cada lista, en la unidad base. Al vender en otra unidad se multiplica por su factor. El mínimo
        es el piso por debajo del cual no se puede vender, en la moneda de la empresa.
      </p>

      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2" data-testid={`item-price-row-${index}`}>
          <select
            name="pricePriceList"
            value={row.priceListId}
            onChange={(event) => update(row.key, { priceListId: event.target.value })}
            aria-label="Lista de precio"
            data-testid={`item-price-list-${index}`}
            className="border-line bg-background min-w-0 flex-1 rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Elige una lista</option>
            {priceLists.map((priceList) => (
              <option key={priceList.id} value={priceList.id}>
                {priceList.name} ({priceList.currency})
              </option>
            ))}
          </select>
          <input
            name="priceValue"
            value={row.price}
            onChange={(event) => update(row.key, { price: event.target.value })}
            inputMode="decimal"
            aria-label="Precio"
            placeholder="Precio"
            data-testid={`item-price-value-${index}`}
            className="border-line bg-background w-28 rounded-md border px-2 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
            data-testid={`item-price-remove-${index}`}
            className="border-line hover:bg-surface rounded-md border px-2 py-2 text-sm"
          >
            Quitar
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, priceListId: '', price: '' }]);
          setNextKey((key) => key + 1);
        }}
        data-testid="item-price-add"
        className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
      >
        Agregar lista
      </button>

      <Field
        label="Precio mínimo"
        name="minPrice"
        testId="item-min-price"
        defaultValue={item?.minPrice === null || item?.minPrice === undefined ? '' : formatNumber(item.minPrice)}
        required={false}
        inputMode="decimal"
        autoComplete="off"
      />
    </fieldset>
  );
}
