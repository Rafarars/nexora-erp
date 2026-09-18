'use client';

import { changeCustomerStatus, saveCustomer } from '@/app/(app)/ventas/actions';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { Field, SelectField, TextArea } from '@/sections/shared/field';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import type { PriceList } from '@/modules/catalog/domain/catalog';
import type { Customer } from '@/modules/sales/domain/sales';

// Un cliente es un maestro como los del catalogo: la misma tabla, el mismo panel y la
// misma politica de desactivar en vez de borrar.
export function CustomersTable({
  customers,
  priceLists,
  ...permissions
}: {
  customers: Customer[];
  priceLists: PriceList[];
  canCreate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
}) {
  return (
    <CatalogTable
      resource="customer"
      title="Clientes"
      description="A quién se le vende. Uno inactivo no recibe pedidos nuevos. El plazo decide cuándo vence su factura y el límite, cuánto se le puede fiar."
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
        {
          header: 'Límite de crédito',
          cell: (customer) => (
            <span data-testid={`customer-credit-${customer.name}`}>{customer.creditLimit === null ? 'Sin límite' : formatAmount(customer.creditLimit)}</span>
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
          <Field
            label="Límite de crédito (vacío: sin límite)"
            name="creditLimit"
            testId="customer-credit-limit"
            defaultValue={customer?.creditLimit === null || customer?.creditLimit === undefined ? '' : formatAmount(customer.creditLimit)}
            inputMode="decimal"
            required={false}
            autoComplete="off"
          />
          {/* Sin lista propia se le cotiza con la lista por defecto de la empresa. */}
          <SelectField
            label="Lista de precio"
            name="priceListId"
            testId="customer-price-list"
            defaultValue={customer?.priceListId ?? ''}
            emptyLabel="La lista por defecto"
            options={priceLists.map((priceList) => ({ value: priceList.id, label: `${priceList.name} (${priceList.currency})` }))}
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
