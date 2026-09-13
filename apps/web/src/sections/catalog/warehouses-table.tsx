'use client';

import { changeWarehouseStatus, saveWarehouse, setDefaultWarehouse } from '@/app/(app)/catalogo/actions';
import { Field } from '@/sections/shared/field';
import type { Warehouse } from '@/modules/catalog/domain/catalog';
import { CatalogTable } from './catalog-table';

export function WarehousesTable({
  warehouses,
  ...permissions
}: {
  warehouses: Warehouse[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="warehouse"
      title="Bodegas"
      description="La bodega por defecto es la que se sugerirá en los documentos. Siempre hay una."
      newLabel="Nueva bodega"
      rows={warehouses}
      columns={[
        {
          header: 'Nombre',
          cell: (warehouse) => (
            <span className="font-medium">
              {warehouse.name}
              {warehouse.isDefault ? (
                <span
                  className="bg-surface border-line ml-2 rounded border px-1.5 py-0.5 text-xs font-normal"
                  data-testid={`warehouse-default-${warehouse.name}`}
                >
                  Por defecto
                </span>
              ) : null}
            </span>
          ),
        },
        { header: 'Dirección', cell: (warehouse) => <span className="text-muted">{warehouse.address ?? '—'}</span> },
      ]}
      renderFields={(warehouse) => (
        <>
          <Field label="Nombre" name="name" testId="warehouse-name" defaultValue={warehouse?.name} autoComplete="off" />
          <Field
            label="Dirección"
            name="address"
            testId="warehouse-address"
            defaultValue={warehouse?.address ?? ''}
            required={false}
            autoComplete="off"
          />
        </>
      )}
      save={saveWarehouse}
      changeStatus={changeWarehouseStatus}
      extraActions={
        permissions.canUpdate
          ? [
              {
                label: 'Marcar por defecto',
                testId: 'make-default',
                action: setDefaultWarehouse,
                visible: (warehouse) => warehouse.isActive && !warehouse.isDefault,
              },
            ]
          : []
      }
      {...permissions}
    />
  );
}
