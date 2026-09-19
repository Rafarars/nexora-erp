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
        {
          header: 'Cantidades',
          cell: (unit) => (
            <span data-testid={`unit-whole-${unit.abbreviation}`}>{unit.mustBeWhole ? 'Solo enteras' : 'Admite decimales'}</span>
          ),
        },
      ]}
      renderFields={(unit) => (
        <>
          <Field label="Nombre" name="name" testId="unit-name" defaultValue={unit?.name} autoComplete="off" />
          <Field label="Abreviatura" name="abbreviation" testId="unit-abbreviation" defaultValue={unit?.abbreviation} autoComplete="off" />
          {/* Media pieza no significa nada; medio kilo si. */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mustBeWhole" defaultChecked={unit?.mustBeWhole ?? false} data-testid="unit-must-be-whole" />
            No admite cantidades con decimales
          </label>
        </>
      )}
      save={saveUnit}
      changeStatus={changeUnitStatus}
      {...permissions}
    />
  );
}
