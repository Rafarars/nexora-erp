'use client';

import { changeTaxStatus, saveTax } from '@/app/(app)/catalogo/actions';
import { Field } from '@/sections/shared/field';
import { formatNumber } from '@/modules/catalog/domain/catalog';
import type { Tax } from '@/modules/catalog/domain/catalog';
import { CatalogTable } from './catalog-table';

export function TaxesTable({
  taxes,
  ...permissions
}: {
  taxes: Tax[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="tax"
      title="Impuestos"
      description="Cambiar un porcentaje no altera los documentos ya emitidos: cada uno copia el suyo al confirmarse."
      newLabel="Nuevo impuesto"
      rows={taxes}
      columns={[
        { header: 'Nombre', cell: (tax) => <span className="font-medium">{tax.name}</span> },
        { header: 'Porcentaje', cell: (tax) => <span data-testid={`tax-rate-${tax.name}`}>{formatNumber(tax.rate)} %</span> },
      ]}
      renderFields={(tax) => (
        <>
          <Field label="Nombre" name="name" testId="tax-name" defaultValue={tax?.name} autoComplete="off" />
          {/* Texto y no number: el campo number del navegador no acepta la coma decimal. */}
          <Field
            label="Porcentaje"
            name="rate"
            testId="tax-rate"
            defaultValue={tax ? formatNumber(tax.rate) : ''}
            inputMode="decimal"
            autoComplete="off"
          />
        </>
      )}
      save={saveTax}
      changeStatus={changeTaxStatus}
      {...permissions}
    />
  );
}
