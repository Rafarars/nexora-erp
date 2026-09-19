'use client';

import { changeSupplierStatus, saveSupplier } from '@/app/(app)/compras/actions';
import { CatalogTable } from '@/sections/catalog/catalog-table';
import { Field, TextArea } from '@/sections/shared/field';
import { Filter, Pager } from '@/sections/shared/filters';
import { paymentTermLabel } from '@/modules/purchasing/domain/purchasing';
import type { Supplier } from '@/modules/purchasing/domain/purchasing';

export interface SupplierSearch {
  q: string;
  active: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Un proveedor es un maestro como los del catalogo: la misma tabla, el mismo panel y la
// misma politica de desactivar en vez de borrar.
export function SuppliersTable({
  suppliers,
  search,
  ...permissions
}: {
  suppliers: Supplier[];
  search: SupplierSearch;
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
      filters={<SupplierFilters search={search} count={suppliers.length} />}
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
          cell: (supplier) => <span data-testid={`supplier-term-${supplier.name}`}>{paymentTermLabel(supplier.paymentTermDays)}</span>,
        },
      ]}
      renderFields={(supplier) => (
        <>
          <Field label="Nombre" name="name" testId="supplier-name" defaultValue={supplier?.name} autoComplete="off" />
          <Field
            label="Identificación fiscal"
            name="fiscalId"
            testId="supplier-fiscal-id"
            defaultValue={supplier?.fiscalId ?? ''}
            required={false}
            autoComplete="off"
          />
          <Field
            label="Correo"
            name="email"
            type="email"
            testId="supplier-email"
            defaultValue={supplier?.email ?? ''}
            required={false}
            autoComplete="off"
          />
          <Field
            label="Teléfono"
            name="phone"
            testId="supplier-phone"
            defaultValue={supplier?.phone ?? ''}
            required={false}
            autoComplete="off"
          />
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

function SupplierFilters({ search, count }: { search: SupplierSearch; count: number }) {
  const pageHref = (page: number) =>
    `/compras/proveedores?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.active ? { activo: search.active } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="supplier-filter">
        <Filter label="Buscar" htmlFor="supplier-search">
          <input
            id="supplier-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código, nombre o identificación fiscal"
            data-testid="supplier-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Estado" htmlFor="supplier-filter-status">
          <select
            id="supplier-filter-status"
            name="activo"
            defaultValue={search.active}
            data-testid="supplier-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </Filter>

        <button
          type="submit"
          data-testid="supplier-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="supplier"
        page={search.page}
        pageSize={search.pageSize}
        count={count}
        total={search.total}
        hasMore={search.hasMore}
        href={pageHref}
      />
    </div>
  );
}
