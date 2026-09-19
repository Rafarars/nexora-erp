import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { CustomerNotFoundError, SalesWarehouseNotFoundError } from '../../domain/errors/sales.errors.js';
import { SalesOrderStatus } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ItemRef, PriceListRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesOrderLineResponse {
  id: string;
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  // Lo que sugirio la lista. Distinto de `unitPrice`, la persona pacto otro precio.
  listPrice: number;
  // Si la linea sale de una bodega. Un servicio no: ni se reserva ni se despacha.
  movesStock: boolean;
  // Lo que ya se facturo de la linea. No mide lo mismo que lo despachado.
  invoicedQuantity: number;
  taxRate: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
}

export interface SalesOrderSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  orders: SalesOrderResponse[];
}

export interface SalesOrderResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  customer: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  priceList: { id: string; name: string } | null;
  status: SalesOrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: SalesOrderLineResponse[];
}

const DEFAULT_PAGE = 20;

export class SalesOrderSearcher {
  constructor(
    private readonly orders: SalesOrderRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    warehouseId?: string | null;
    status?: SalesOrderStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<SalesOrderSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por algo de otra empresa responde como en el resto del sistema: no existe. Una
    // lista vacia diria que ese cliente no tiene pedidos, que es una respuesta distinta.
    if (request.customerId && !(await this.customers.find(tenantId, CustomerId.of(request.customerId)))) {
      throw new CustomerNotFoundError(request.customerId);
    }
    if (request.warehouseId) {
      const found = await this.catalog.findWarehouses(tenantId, [WarehouseRef.of(request.warehouseId)]);

      if (found.length === 0) throw new SalesWarehouseNotFoundError(request.warehouseId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.orders.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      customerId: request.customerId ?? null,
      warehouseId: request.warehouseId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const orders = page.orders;
    const rows = orders.map((order) => order.toPrimitives());
    const decimals = await this.rates.amountDecimals(request.tenantId);

    const [customers, items, warehouses, priceLists] = await Promise.all([
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((o) => o.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((o) => o.warehouseId))].map((id) => WarehouseRef.of(id))),
      Promise.all(
        [...new Set(rows.map((o) => o.priceListId).filter((id): id is string => id !== null))].map((id) =>
          this.catalog.findPriceList(tenantId, PriceListRef.of(id)),
        ),
      ),
    ]);
    const priceListOf = (id: string | null) => {
      const found = id ? priceLists.find((priceList) => priceList?.id === id) : null;

      return found ? { id: found.id, name: found.name } : null;
    };

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + orders.length < page.total,
      orders: orders
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((order) => {
          const row = order.toPrimitives();

          return {
            id: row.id,
            code: row.code,
            customer: { id: row.customerId, name: customers.find((c) => c.id.value === row.customerId)?.name() ?? '' },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            date: row.orderDate,
            notes: row.notes,
            priceList: priceListOf(row.priceListId),
            status: row.status,
            ...order.currency().toPrimitives(),
            totals: order.totals(decimals),
            lines: order.lines().map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId.value);
              const { id, lineNumber, itemId, unitId, quantity, baseQuantity, unitPrice, listPrice, taxRate, dispatchedQuantity, movesStock, invoicedQuantity } = line.toPrimitives();

              return {
                id,
                lineNumber,
                itemId,
                // Lo que la linea copio al escribirse: renombrar el articulo no cambia el documento.
                sku: line.itemSku,
                itemName: line.itemName,
                unitId,
                unitAbbreviation: item?.units.find((unit) => unit.unitId === unitId)?.abbreviation ?? '',
                quantity,
                baseQuantity,
                unitPrice,
                listPrice,
                movesStock,
                invoicedQuantity,
                taxRate,
                dispatchedQuantity,
                pendingQuantity: line.pending().toNumber(),
                subtotal: unitsToNumber(line.subtotalUnits(decimals)),
              };
            }),
          };
        }),
    };
  }
}
