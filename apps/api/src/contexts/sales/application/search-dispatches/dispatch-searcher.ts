import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { DispatchStatus } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { SalesOrderNotFoundError, SalesWarehouseNotFoundError } from '../../domain/errors/sales.errors.js';
import { InvoiceRepository } from '../../domain/invoice/invoice.repository.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface DispatchResponse {
  id: string;
  code: string;
  order: { id: string; code: string };
  customer: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: DispatchStatus;
  // La factura emitida que tiene, si tiene: decide si se puede facturar o anular.
  invoice: { id: string; code: string } | null;
  lines: {
    id: string;
    lineNumber: number;
    orderLineId: string;
    itemId: string;
    sku: string;
    itemName: string;
    unitId: string;
    unitAbbreviation: string;
    quantity: number;
    baseQuantity: number;
  }[];
}

export interface DispatchSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  dispatches: DispatchResponse[];
}

const DEFAULT_PAGE = 20;

export class DispatchSearcher {
  constructor(
    private readonly dispatches: DispatchRepository,
    private readonly orders: SalesOrderRepository,
    private readonly invoices: InvoiceRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    orderId?: string | null;
    warehouseId?: string | null;
    status?: DispatchStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<DispatchSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por algo de otra empresa responde como en el resto del sistema: no existe.
    if (request.orderId && !(await this.orders.find(tenantId, SalesOrderId.of(request.orderId)))) {
      throw new SalesOrderNotFoundError(request.orderId);
    }
    if (request.warehouseId) {
      const found = await this.catalog.findWarehouses(tenantId, [WarehouseRef.of(request.warehouseId)]);

      if (found.length === 0) throw new SalesWarehouseNotFoundError(request.warehouseId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.dispatches.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      orderId: request.orderId ?? null,
      warehouseId: request.warehouseId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const rows = page.dispatches.map((dispatch) => dispatch.toPrimitives());

    const [orders, invoices, customers, items, warehouses] = await Promise.all([
      this.orders.searchByTenant(tenantId),
      this.invoices.searchByTenant(tenantId),
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((r) => r.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((r) => r.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
      dispatches: rows
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((row) => {
          const order = orders.find((candidate) => candidate.id.value === row.orderId);
          const customerId = order?.customerId().value ?? '';
          const invoice = invoices.find((candidate) => candidate.dispatchId()?.value === row.id && candidate.currentStatus() === 'issued');

          return {
            id: row.id,
            code: row.code,
            order: { id: row.orderId, code: order?.code ?? '' },
            customer: { id: customerId, name: customers.find((c) => c.id.value === customerId)?.name() ?? '' },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            date: row.dispatchDate,
            notes: row.notes,
            status: row.status,
            invoice: invoice ? { id: invoice.id.value, code: invoice.toPrimitives().code } : null,
            lines: row.lines.map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId);

              return {
                ...line,
                // Lo que la linea copio al escribirse: renombrar el articulo no cambia el documento.
                sku: line.itemSku,
                itemName: line.itemName,
                unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
              };
            }),
          };
        }),
    };
  }
}
