'use client';

import { changeSupplierStatus, saveSupplier } from '@/app/(app)/compras/actions';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { Field, TextArea } from '@/sections/shared/field';
import type { Supplier } from '@/modules/purchasing/domain/purchasing';

// Un proveedor es un maestro como los del catalogo: la misma tabla, el mismo panel y la
// misma politica de desactivar en vez de borrar.
export function SuppliersTable({
  suppliers,
  ...permissions
}: {
  suppliers: Supplier[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="supplier"
      title="Proveedores"
      description="A quién se le compra. Uno inactivo no recibe órdenes nuevas."
      newLabel="Nuevo proveedor"
      rows={suppliers}
      columns={[
        {
          header: 'Nombre',
          cell: (supplier) => (
            <>
              <p className="font-medium">{supplier.name}</p>
              {supplier.fiscalId ? <p className="text-muted font-mono text-xs">{supplier.fiscalId}</p> : null}
            </>
          ),
        },
        {
          header: 'Contacto',
          cell: (supplier) => <span className="text-muted">{[supplier.email, supplier.phone].filter(Boolean).join(' · ') || '—'}</span>,
        },
        {
          header: 'Plazo',
          cell: (supplier) => (
            <span data-testid={`supplier-term-${supplier.name}`}>{supplier.paymentTermDays === 0 ? 'Contado' : `${supplier.paymentTermDays} días`}</span>
          ),
        },
      ]}
      renderFields={(supplier) => (
        <>
          <Field label="Nombre" name="name" testId="supplier-name" defaultValue={supplier?.name} autoComplete="off" />
          <Field label="Identificación fiscal" name="fiscalId" testId="supplier-fiscal-id" defaultValue={supplier?.fiscalId ?? ''} required={false} autoComplete="off" />
          <Field label="Correo" name="email" type="email" testId="supplier-email" defaultValue={supplier?.email ?? ''} required={false} autoComplete="off" />
          <Field label="Teléfono" name="phone" testId="supplier-phone" defaultValue={supplier?.phone ?? ''} required={false} autoComplete="off" />
          <Field
            label="Plazo de pago (días)"
            name="paymentTermDays"
            testId="supplier-term"
            defaultValue={String(supplier?.paymentTermDays ?? 0)}
            inputMode="numeric"
            required={false}
            autoComplete="off"
          />
          <TextArea label="Dirección" name="address" testId="supplier-address" defaultValue={supplier?.address ?? ''} />
        </>
      )}
      save={saveSupplier}
      changeStatus={changeSupplierStatus}
      {...permissions}
    />
  );
}
