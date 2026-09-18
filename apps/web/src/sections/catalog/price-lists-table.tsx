'use client';

import { changePriceListStatus, savePriceList, setDefaultPriceList } from '@/app/(app)/catalogo/actions';
import { Field, SelectField, TextArea } from '@/sections/shared/field';
import type { Currency } from '@/modules/company/domain/company';
import type { PriceList } from '@/modules/catalog/domain/catalog';
import { CatalogTable } from './catalog-table';

export function PriceListsTable({
  priceLists,
  currencies,
  ...permissions
}: {
  priceLists: PriceList[];
  currencies: Currency[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="price-list"
      title="Listas de precio"
      description="Cada lista nombra un conjunto de precios y dice en qué moneda están. Los precios se cargan en el artículo. La lista por defecto es la que se usa con un cliente que no tiene la suya."
      newLabel="Nueva lista"
      rows={priceLists}
      columns={[
        {
          header: 'Nombre',
          cell: (priceList) => (
            <span className="font-medium">
              {priceList.name}
              {priceList.isDefault ? (
                <span
                  className="bg-surface border-line ml-2 rounded border px-1.5 py-0.5 text-xs font-normal"
                  data-testid={`price-list-default-${priceList.name}`}
                >
                  Por defecto
                </span>
              ) : null}
            </span>
          ),
        },
        { header: 'Moneda', cell: (priceList) => <span className="tabular-nums">{priceList.currency}</span> },
        { header: 'Descripción', cell: (priceList) => <span className="text-muted">{priceList.description ?? '—'}</span> },
      ]}
      renderFields={(priceList) => (
        <>
          <Field label="Nombre" name="name" testId="price-list-name" defaultValue={priceList?.name} autoComplete="off" />
          {priceList ? (
            // La moneda no se edita: cambiarla reinterpretaria de golpe todos los precios cargados.
            <input type="hidden" name="currency" value={priceList.currency} />
          ) : (
            <SelectField
              label="Moneda"
              name="currency"
              testId="price-list-currency"
              options={currencies.map((currency) => ({ value: currency.code, label: `${currency.code} · ${currency.name}` }))}
            />
          )}
          <TextArea label="Descripción" name="description" testId="price-list-description" defaultValue={priceList?.description ?? ''} />
        </>
      )}
      save={savePriceList}
      changeStatus={changePriceListStatus}
      extraActions={
        permissions.canUpdate
          ? [
              {
                label: 'Marcar por defecto',
                testId: 'make-default',
                action: setDefaultPriceList,
                visible: (priceList) => priceList.isActive && !priceList.isDefault,
              },
            ]
          : []
      }
      {...permissions}
    />
  );
}
