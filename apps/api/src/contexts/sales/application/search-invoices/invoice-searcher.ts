import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { CustomerNotFoundError } from '../../domain/errors/sales.errors.js';
import { InvoiceStatus } from '../../domain/invoice/invoice.entity.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';

export interface InvoiceResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  customer: { id: string; name: string };
  // Nulo cuando la factura solo cobra servicios: no hubo despacho.
  dispatch: { id: string; code: string } | null;
  order: { id: string; code: string };
  issueDate: string;
  dueDate: string;
  notes: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  // A la tasa de emision; null en las facturas anteriores a las tasas.
  subtotalVes: number | null;
  taxVes: number | null;
  totalVes: number | null;
  lines: {
    lineNumber: number;
    itemId: string;
    sku: string;
    itemName: string;
    unitAbbreviation: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
    tax: number;
  }[];
}

export interface InvoiceSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  invoices: InvoiceResponse[];
}

const DEFAULT_PAGE = 20;

export class InvoiceSearcher {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly dispatches: DispatchRepository,
    private readonly orders: SalesOrderRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    status?: InvoiceStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<InvoiceSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por un cliente de otra empresa responde como el resto del sistema: no existe. Una
    // lista vacia diria que ese cliente no tiene facturas, que es una respuesta distinta.
    if (request.customerId && !(await this.customers.find(tenantId, CustomerId.of(request.customerId)))) {
      throw new CustomerNotFoundError(request.customerId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.invoices.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      customerId: request.customerId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const invoices = page.invoices;
    const rows = invoices.map((invoice) => invoice.toPrimitives());

    const [dispatches, orders, customers, items] = await Promise.all([
      this.dispatches.searchByTenant(tenantId),
      this.orders.searchByTenant(tenantId),
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Map(invoices.flatMap((i) => i.lineItems()).map((l) => [l.itemId.value, l.itemId])).values()]),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
      invoices: rows
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((row) => ({
          id: row.id,
          code: row.code,
          customer: { id: row.customerId, name: customers.find((c) => c.id.value === row.customerId)?.name() ?? '' },
          // Una factura de puros servicios no nace de un despacho.
          dispatch: row.dispatchId === null ? null : { id: row.dispatchId, code: dispatches.find((d) => d.id.value === row.dispatchId)?.code ?? '' },
          order: { id: row.orderId, code: orders.find((o) => o.id.value === row.orderId)?.code ?? '' },
          issueDate: row.issueDate,
          dueDate: row.dueDate,
          notes: row.notes,
          status: row.status,
          subtotal: row.subtotal,
          tax: row.tax,
          total: row.total,
          currency: row.currency,
          exchangeRate: row.exchangeRate,
          baseCurrency: row.baseCurrency,
          baseExchangeRate: row.baseExchangeRate,
          manualExchangeRate: row.manualExchangeRate,
          subtotalVes: row.subtotalVes,
          taxVes: row.taxVes,
          totalVes: row.totalVes,
          lines: row.lines.map((line) => {
            const item = items.find((candidate) => candidate.id === line.itemId);

            return {
              lineNumber: line.lineNumber,
              itemId: line.itemId,
              // Lo que la linea copio al escribirse: renombrar el articulo no cambia el documento.
                sku: line.itemSku,
              itemName: line.itemName,
              unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              subtotal: line.subtotal,
              tax: line.tax,
            };
          }),
        })),
    };
  }
}
