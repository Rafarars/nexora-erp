import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
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
  taxRate: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
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

export class SalesOrderSearcher {
  constructor(
    private readonly orders: SalesOrderRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string }): Promise<{ orders: SalesOrderResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const orders = await this.orders.searchByTenant(tenantId);
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
              const { id, lineNumber, itemId, unitId, quantity, baseQuantity, unitPrice, listPrice, taxRate, dispatchedQuantity } = line.toPrimitives();

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
