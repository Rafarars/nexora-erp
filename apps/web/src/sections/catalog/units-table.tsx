'use client';

import { changeUnitStatus, saveUnit } from '@/app/(app)/catalogo/actions';
import { Field } from '@/sections/shared/field';
import type { MeasurementUnit } from '@/modules/catalog/domain/catalog';
import { CatalogTable } from './catalog-table';

export function UnitsTable({
  units,
  ...permissions
}: {
  units: MeasurementUnit[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="unit"
      title="Unidades de medida"
      description="Cuántas unidades trae una caja se define en cada artículo, no aquí."
      newLabel="Nueva unidad"
      rows={units}
      columns={[
        { header: 'Nombre', cell: (unit) => <span className="font-medium">{unit.name}</span> },
        { header: 'Abreviatura', cell: (unit) => <span className="font-mono text-xs">{unit.abbreviation}</span> },
      ]}
      renderFields={(unit) => (
        <>
          <Field label="Nombre" name="name" testId="unit-name" defaultValue={unit?.name} autoComplete="off" />
          <Field label="Abreviatura" name="abbreviation" testId="unit-abbreviation" defaultValue={unit?.abbreviation} autoComplete="off" />
        </>
      )}
      save={saveUnit}
      changeStatus={changeUnitStatus}
      {...permissions}
    />
  );
}
