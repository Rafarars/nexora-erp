import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { PurchaseOrderNotFoundError, PurchaseWarehouseNotFoundError } from '../../domain/errors/purchasing.errors.js';
import { GoodsReceiptStatus } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import { DocumentCurrencyPrimitives } from '../../../../shared/domain/document-currency.js';
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

export interface GoodsReceiptResponse extends DocumentCurrencyPrimitives {
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

export interface GoodsReceiptSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  receipts: GoodsReceiptResponse[];
}

const DEFAULT_PAGE = 20;

export class GoodsReceiptSearcher {
  constructor(
    private readonly receipts: GoodsReceiptRepository,
    private readonly orders: PurchaseOrderRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: PurchasingCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    orderId?: string | null;
    warehouseId?: string | null;
    status?: GoodsReceiptStatus;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<GoodsReceiptSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    // Filtrar por algo de otra empresa responde como en el resto del sistema: no existe.
    if (request.orderId && !(await this.orders.find(tenantId, PurchaseOrderId.of(request.orderId)))) {
      throw new PurchaseOrderNotFoundError(request.orderId);
    }
    if (request.warehouseId) {
      const found = await this.catalog.findWarehouses(tenantId, [WarehouseRef.of(request.warehouseId)]);

      if (found.length === 0) throw new PurchaseWarehouseNotFoundError(request.warehouseId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.receipts.searchPage(tenantId, {
      text: request.q?.trim() ? request.q.trim() : null,
      orderId: request.orderId ?? null,
      warehouseId: request.warehouseId ?? null,
      status: request.status ?? null,
      from: request.from ?? null,
      to: request.to ?? null,
      limit,
      offset,
    });
    const rows = page.receipts.map((receipt) => receipt.toPrimitives());

    const [orders, suppliers, items, warehouses] = await Promise.all([
      this.orders.searchByTenant(tenantId),
      this.suppliers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, [...new Set(rows.flatMap((r) => r.lines.map((l) => l.itemId)))].map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, [...new Set(rows.map((r) => r.warehouseId))].map((id) => WarehouseRef.of(id))),
    ]);

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + rows.length < page.total,
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
            currency: row.currency,
            exchangeRate: row.exchangeRate,
            baseCurrency: row.baseCurrency,
            baseExchangeRate: row.baseExchangeRate,
            manualExchangeRate: row.manualExchangeRate,
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
