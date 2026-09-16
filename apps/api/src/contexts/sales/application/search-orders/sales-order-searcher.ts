import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { SalesOrderStatus } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { baseToNumber } from '../../domain/shared/money.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
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
  taxRate: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
}

export interface SalesOrderResponse {
  id: string;
  code: string;
  customer: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: SalesOrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: SalesOrderLineResponse[];
}

export class SalesOrderSearcher {
  constructor(
    private readonly orders: SalesOrderRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: { tenantId: string }): Promise<{ orders: SalesOrderResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const orders = await this.orders.searchByTenant(tenantId);
    const rows = orders.map((order) => order.toPrimitives());

    const [customers, items, warehouses] = await Promise.all([
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((o) => o.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((o) => o.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    return {
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
            status: row.status,
            totals: order.totals(),
            lines: order.lines().map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId.value);
              const { id, lineNumber, itemId, unitId, quantity, baseQuantity, unitPrice, taxRate, dispatchedQuantity } = line.toPrimitives();

              return {
                id,
                lineNumber,
                itemId,
                sku: item?.sku ?? '',
                itemName: item?.name ?? '',
                unitId,
                unitAbbreviation: item?.units.find((unit) => unit.unitId === unitId)?.abbreviation ?? '',
                quantity,
                baseQuantity,
                unitPrice,
                taxRate,
                dispatchedQuantity,
                pendingQuantity: line.pending().toNumber(),
                subtotal: baseToNumber(line.subtotalBase()),
              };
            }),
          };
        }),
    };
  }
}
