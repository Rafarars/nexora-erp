import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchaseOrderStatus } from '../../domain/order/purchase-order.entity.js';
import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
import { unitsToNumber } from '../../../../shared/domain/amount.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

export interface PurchaseOrderLineResponse {
  id: string;
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  taxRate: number;
  receivedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
}

export interface PurchaseOrderResponse extends DocumentCurrencyPrimitives {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  expectedDate: string | null;
  notes: string | null;
  status: PurchaseOrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: PurchaseOrderLineResponse[];
}

// Las mas recientes primero, con proveedor, bodega y articulos resueltos y lo pendiente de
// cada linea a la vista.
export class PurchaseOrderSearcher {
  constructor(
    private readonly orders: PurchaseOrderRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: PurchasingCatalog,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string }): Promise<{ orders: PurchaseOrderResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const orders = await this.orders.searchByTenant(tenantId);
    const rows = orders.map((order) => order.toPrimitives());

    const [suppliers, items, warehouses, decimals] = await Promise.all([
      this.suppliers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((o) => o.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((o) => o.warehouseId))].map((id) => WarehouseRef.of(id))),
      this.rates.amountDecimals(request.tenantId),
    ]);

    return {
      orders: orders
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((order) => {
          const row = order.toPrimitives();

          return {
            id: row.id,
            code: row.code,
            supplier: { id: row.supplierId, name: suppliers.find((s) => s.id.value === row.supplierId)?.name() ?? '' },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            date: row.orderDate,
            expectedDate: row.expectedDate,
            notes: row.notes,
            status: row.status,
            ...order.currency().toPrimitives(),
            totals: order.totals(decimals),
            lines: order.lines().map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId.value);
              const { id, lineNumber, itemId, unitId, quantity, baseQuantity, unitCost, taxRate, receivedQuantity } = line.toPrimitives();

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
                unitCost,
                taxRate,
                receivedQuantity,
                pendingQuantity: line.pending().toNumber(),
                subtotal: unitsToNumber(line.subtotalUnits(decimals)),
              };
            }),
          };
        }),
    };
  }
}
