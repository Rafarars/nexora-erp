'use client';

import { useActionState } from 'react';
import { cancelInvoice } from '@/app/(app)/ventas/actions';
import { MenuButton } from '@/sections/purchasing/menu-button';
import { FormError } from '@/sections/shared/field';
import { RowOptions } from '@/sections/shared/row-options';
import { emptyState } from '@/shared/forms/form-state';
import { formatQuantity } from '@/modules/inventory/domain/inventory';
import { formatAmount } from '@/modules/purchasing/domain/purchasing';
import { INVOICE_STATUS_LABELS } from '@/modules/sales/domain/sales';
import { DocumentRate } from '@/sections/shared/document-rate';
import { Filter, Pager } from '@/sections/shared/filters';
import type { Customer, Invoice, InvoiceStatus } from '@/modules/sales/domain/sales';

export interface InvoiceSearch {
  q: string;
  customerId: string;
  status: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Las facturas se emiten desde su despacho ("Facturar"). Aqui se consultan y se anulan.
export function InvoicesBoard({
  invoices,
  search,
  customers,
  canCancel,
}: {
  invoices: Invoice[];
  search: InvoiceSearch;
  customers: Customer[];
  canCancel: boolean;
}) {
  const [state, cancel] = useActionState(cancelInvoice, emptyState);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Facturas</h2>
        <p className="text-muted mt-1 text-sm">Cobran lo que salió en un despacho, más los servicios del pedido, que no salen de ninguna bodega. No mueven existencia; anular una deja volver a facturar.</p>
      </div>

      <InvoiceFilters search={search} customers={customers} count={invoices.length} />

      <FormError message={state.error} testId="invoice-action-error" />

      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" data-testid="invoices-table">
          <thead className="bg-surface text-muted text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Despacho</th>
              <th className="px-4 py-2 font-medium">Líneas</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Vence</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              {canCancel ? <th className="w-16 px-4 py-2" aria-label="Opciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-line border-t align-top" data-testid={`invoice-row-${invoice.code}`}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs">{invoice.code}</p>
                  <p className="text-muted text-xs">{invoice.issueDate}</p>
                </td>
                <td className="px-4 py-3">{invoice.customer.name}</td>
                <td className="px-4 py-3">
                  {/* Una factura de puros servicios no nace de un despacho. */}
                  <p className="font-mono text-xs">{invoice.dispatch?.code ?? '—'}</p>
                  <p className="text-muted font-mono text-xs">{invoice.order.code}</p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {invoice.lines.map((line) => (
                    <p key={line.lineNumber}>
                      {formatQuantity(line.quantity)} {line.unitAbbreviation} {line.sku} × {formatAmount(line.unitPrice)}
                    </p>
                  ))}
                </td>
                <td className="px-4 py-3 text-right" data-testid={`invoice-total-${invoice.code}`}>
                  <p>
                    {invoice.currency} {formatAmount(invoice.total)}
                  </p>
                  <p className="text-muted text-xs">IVA {formatAmount(invoice.tax)}</p>
                  {/* Los bolivares de la factura son los que escribio al emitirse: son los que valen ante la ley. */}
                  <DocumentRate document={invoice} bolivars={invoice.totalVes} testId={`invoice-rate-${invoice.code}`} />
                </td>
                <td className="px-4 py-3" data-testid={`invoice-due-${invoice.code}`}>
                  {invoice.dueDate}
                </td>
                <td className="px-4 py-3" data-testid={`invoice-status-${invoice.code}`}>
                  {INVOICE_STATUS_LABELS[invoice.status]}
                </td>
                {canCancel ? (
                  <td className="px-4 py-3 text-right">
                    {invoice.status === 'issued' ? (
                      <RowOptions testId={`invoice-options-${invoice.code}`}>
                        {(close) => (
                          <form action={cancel} onSubmit={close}>
                            <input type="hidden" name="id" value={invoice.id} />
                            <MenuButton type="submit" testId={`invoice-cancel-${invoice.code}`}>
                              Anular
                            </MenuButton>
                          </form>
                        )}
                      </RowOptions>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}

            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-muted px-4 py-6 text-center" data-testid="invoices-empty">
                  Todavía no hay facturas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoiceFilters({ search, customers, count }: { search: InvoiceSearch; customers: Customer[]; count: number }) {
  const pageHref = (page: number) =>
    `/ventas/facturas?${new URLSearchParams({
      ...(search.q ? { q: search.q } : {}),
      ...(search.customerId ? { cliente: search.customerId } : {}),
      ...(search.status ? { estado: search.status } : {}),
      ...(search.from ? { desde: search.from } : {}),
      ...(search.to ? { hasta: search.to } : {}),
      ...(page > 1 ? { pagina: String(page) } : {}),
    }).toString()}`;

  return (
    <div className="border-line space-y-3 rounded-lg border p-3">
      {/* Un formulario GET: los filtros quedan en la direccion y se pueden compartir. */}
      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="invoice-filter">
        <Filter label="Buscar" htmlFor="invoice-search">
          <input
            id="invoice-search"
            name="q"
            defaultValue={search.q}
            placeholder="Código de la factura, de su pedido o nombre del cliente"
            data-testid="invoice-search"
            className="border-line bg-background w-72 rounded-md border px-3 py-2 text-sm"
          />
        </Filter>

        {customers.length > 0 ? (
          <Filter label="Cliente" htmlFor="invoice-filter-customer">
            <select
              id="invoice-filter-customer"
              name="cliente"
              defaultValue={search.customerId}
              data-testid="invoice-filter-customer"
              className="border-line bg-background rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Filter>
        ) : null}

        <Filter label="Estado" htmlFor="invoice-filter-status">
          <select
            id="invoice-filter-status"
            name="estado"
            defaultValue={search.status}
            data-testid="invoice-filter-status"
            className="border-line bg-background rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((status) => (
              <option key={status} value={status}>
                {INVOICE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Filter>

        <Filter label="Desde" htmlFor="invoice-filter-from">
          <input
            id="invoice-filter-from"
            name="desde"
            type="date"
            defaultValue={search.from}
            data-testid="invoice-filter-from"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <Filter label="Hasta" htmlFor="invoice-filter-to">
          <input
            id="invoice-filter-to"
            name="hasta"
            type="date"
            defaultValue={search.to}
            data-testid="invoice-filter-to"
            className="border-line rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </Filter>

        <button
          type="submit"
          data-testid="invoice-filter-submit"
          className="border-line hover:bg-surface rounded-md border px-3 py-2 text-sm"
        >
          Filtrar
        </button>
      </form>

      <Pager
        testId="invoice"
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
