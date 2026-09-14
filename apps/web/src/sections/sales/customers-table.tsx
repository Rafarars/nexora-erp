'use client';

import { changeCustomerStatus, saveCustomer } from '@/app/(app)/ventas/actions';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { Field, TextArea } from '@/sections/shared/field';
import type { Customer } from '@/modules/sales/domain/sales';

// Un cliente es un maestro como los del catalogo: la misma tabla, el mismo panel y la
// misma politica de desactivar en vez de borrar.
export function CustomersTable({
  customers,
  ...permissions
}: {
  customers: Customer[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="customer"
      title="Clientes"
      description="A quién se le vende. Uno inactivo no recibe pedidos nuevos. El plazo decide cuándo vence su factura."
      newLabel="Nuevo cliente"
      rows={customers}
      columns={[
        {
          header: 'Nombre',
          cell: (customer) => (
            <>
              <p className="font-medium">{customer.name}</p>
              {customer.fiscalId ? <p className="text-muted font-mono text-xs">{customer.fiscalId}</p> : null}
            </>
          ),
        },
        {
          header: 'Contacto',
          cell: (customer) => <span className="text-muted">{[customer.email, customer.phone].filter(Boolean).join(' · ') || '—'}</span>,
        },
        {
          header: 'Plazo',
          cell: (customer) => (
            <span data-testid={`customer-term-${customer.name}`}>{customer.paymentTermDays === 0 ? 'Contado' : `${customer.paymentTermDays} días`}</span>
          ),
        },
      ]}
      renderFields={(customer) => (
        <>
          <Field label="Nombre" name="name" testId="customer-name" defaultValue={customer?.name} autoComplete="off" />
          <Field label="Identificación fiscal" name="fiscalId" testId="customer-fiscal-id" defaultValue={customer?.fiscalId ?? ''} required={false} autoComplete="off" />
          <Field label="Correo" name="email" type="email" testId="customer-email" defaultValue={customer?.email ?? ''} required={false} autoComplete="off" />
          <Field label="Teléfono" name="phone" testId="customer-phone" defaultValue={customer?.phone ?? ''} required={false} autoComplete="off" />
          <Field
            label="Plazo de pago (días)"
            name="paymentTermDays"
            testId="customer-term"
            defaultValue={String(customer?.paymentTermDays ?? 0)}
            inputMode="numeric"
            required={false}
            autoComplete="off"
          />
          <TextArea label="Dirección" name="address" testId="customer-address" defaultValue={customer?.address ?? ''} />
        </>
      )}
      save={saveCustomer}
      changeStatus={changeCustomerStatus}
      {...permissions}
    />
  );
}
