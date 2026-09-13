import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { GoodsReceiptStatus } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

export interface GoodsReceiptLineResponse {
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
  unitCost: number;
}

export interface GoodsReceiptResponse {
  id: string;
  code: string;
  order: { id: string; code: string };
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: GoodsReceiptStatus;
  lines: GoodsReceiptLineResponse[];
}

export class GoodsReceiptSearcher {
  constructor(
    private readonly receipts: GoodsReceiptRepository,
    private readonly orders: PurchaseOrderRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: PurchasingCatalog,
  ) {}

  async run(request: { tenantId: string }): Promise<{ receipts: GoodsReceiptResponse[] }> {
    const tenantId = TenantId.of(request.tenantId);
    const rows = (await this.receipts.searchByTenant(tenantId)).map((receipt) => receipt.toPrimitives());

    const [orders, suppliers, items, warehouses] = await Promise.all([
      this.orders.searchByTenant(tenantId),
      this.suppliers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((r) => r.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((r) => r.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    return {
      receipts: rows
        .sort((a, b) => b.code.localeCompare(a.code))
        .map((row) => {
          const order = orders.find((candidate) => candidate.id.value === row.orderId);
          const supplierId = order?.supplierId().value ?? '';

          return {
            id: row.id,
            code: row.code,
            order: { id: row.orderId, code: order?.code ?? '' },
            supplier: { id: supplierId, name: suppliers.find((s) => s.id.value === supplierId)?.name() ?? '' },
            warehouse: { id: row.warehouseId, name: warehouses.find((w) => w.id === row.warehouseId)?.name ?? '' },
            date: row.receiptDate,
            notes: row.notes,
            status: row.status,
            lines: row.lines.map((line) => {
              const item = items.find((candidate) => candidate.id === line.itemId);

              return {
                ...line,
                sku: item?.sku ?? '',
                itemName: item?.name ?? '',
                unitAbbreviation: item?.units.find((unit) => unit.unitId === line.unitId)?.abbreviation ?? '',
              };
            }),
          };
        }),
    };
  }
}
