import { PurchasingCatalog } from '../../domain/catalog/purchasing-catalog.js';
import { GoodsReceiptFinder } from '../../domain/receipt/find/goods-receipt-finder.js';
import { GoodsReceiptId } from '../../domain/receipt/goods-receipt.entity.js';
import { GoodsReceiptRepository } from '../../domain/receipt/goods-receipt.repository.js';
import {
  GoodsReceiptNotFoundError,
  PurchaseReturnNotFoundError,
  PurchaseWarehouseNotFoundError,
  SupplierNotFoundError,
} from '../../domain/errors/purchasing.errors.js';
import { PurchaseReturnId, PurchaseReturnStatus } from '../../domain/return/purchase-return.entity.js';
import { PurchaseReturnRepository } from '../../domain/return/purchase-return.repository.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseReturnLineResponse {
  id: string;
  lineNumber: number;
  receiptLineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  restoresMovementId: string | null;
}

export interface PurchaseReturnResponse {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  receipt: { id: string; code: string };
  warehouse: { id: string; name: string };
  date: string;
  reason: string | null;
  notes: string | null;
  status: PurchaseReturnStatus;
  confirmedAt: string | null;
  cancelledAt: string | null;
  currency: {
    code: string;
    symbol: string;
    exchangeRate: number;
  };
  lines: PurchaseReturnLineResponse[];
}

export interface PurchaseReturnSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  returns: PurchaseReturnResponse[];
}

const DEFAULT_PAGE = 20;

export class PurchaseReturnSearcher {
  constructor(
    private readonly returns: PurchaseReturnRepository,
    private readonly receipts: GoodsReceiptRepository,
    private readonly suppliers: SupplierRepository,
    private readonly catalog: PurchasingCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    supplierId?: string | null;
    receiptId?: string | null;
    status?: PurchaseReturnStatus | null;
    from?: string | null;
    to?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<PurchaseReturnSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.supplierId && !(await this.suppliers.find(tenantId, SupplierId.of(request.supplierId)))) {
      throw new SupplierNotFoundError(request.supplierId);
    }
    if (request.receiptId) {
      const found = await this.receipts.find(tenantId, GoodsReceiptId.of(request.receiptId));
      if (!found) throw new GoodsReceiptNotFoundError(request.receiptId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.returns.searchPage(tenantId, {
      supplierId: request.supplierId ?? undefined,
      receiptId: request.receiptId ?? undefined,
      status: request.status ?? undefined,
      from: request.from ?? undefined,
      to: request.to ?? undefined,
      text: request.q?.trim() ? request.q.trim() : undefined,
      limit,
      offset,
    });

    const rows = page.returns.map((r) => r.toPrimitives());

    const receiptIds = [...new Set(rows.map((r) => r.receiptId))];
    const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];
    const itemIds = [...new Set(rows.flatMap((r) => r.lines.map((l) => l.itemId)))];

    const [receipts, suppliers, items, warehouses] = await Promise.all([
      Promise.all(receiptIds.map((id) => this.receipts.find(tenantId, GoodsReceiptId.of(id)))),
      Promise.all(supplierIds.map((id) => this.suppliers.find(tenantId, SupplierId.of(id)))),
      this.catalog.findItems(tenantId, itemIds.map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, warehouseIds.map((id) => WarehouseRef.of(id))),
    ]);

    const receiptMap = new Map(receipts.filter(Boolean).map((r) => [r!.id.value, r!]));
    const supplierMap = new Map(suppliers.filter(Boolean).map((s) => [s!.id.value, s!]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    const mappedReturns: PurchaseReturnResponse[] = rows.map((row) => {
      const receipt = receiptMap.get(row.receiptId);
      const supplier = supplierMap.get(row.supplierId);
      const warehouse = warehouseMap.get(row.warehouseId);

      return {
        id: row.id,
        code: row.code,
        supplier: { id: row.supplierId, name: supplier ? supplier.name() : row.supplierId },
        receipt: { id: row.receiptId, code: receipt ? receipt.code : row.receiptId },
        warehouse: { id: row.warehouseId, name: warehouse?.name ?? row.warehouseId },
        date: row.returnDate,
        reason: row.reason,
        notes: row.notes,
        status: row.status,
        confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
        cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
        currency: {
          code: row.currency,
          symbol: row.currency === 'USD' ? '$' : 'Bs',
          exchangeRate: row.exchangeRate ?? 1,
        },
        lines: row.lines.map((l) => {
          const item = itemMap.get(l.itemId);
          const unit = item?.units.find((u) => u.unitId === l.unitId);
          return {
            id: l.id,
            lineNumber: l.lineNumber,
            receiptLineId: l.receiptLineId,
            itemId: l.itemId,
            sku: l.itemSku,
            itemName: l.itemName,
            unitId: l.unitId,
            unitAbbreviation: unit?.abbreviation ?? '',
            quantity: l.quantity,
            baseQuantity: l.baseQuantity,
            unitCost: l.unitCost,
            restoresMovementId: l.restoresMovementId,
          };
        }),
      };
    });

    return {
      total: page.total,
      limit,
      offset,
      hasMore: offset + mappedReturns.length < page.total,
      returns: mappedReturns,
    };
  }

  async search(request: Parameters<PurchaseReturnSearcher['run']>[0]): Promise<PurchaseReturnSearcherResponse> {
    return this.run(request);
  }

  async findById(request: { tenantId: string; returnId: string }): Promise<PurchaseReturnResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const returnEntity = await this.returns.find(tenantId, PurchaseReturnId.of(request.returnId));
    if (!returnEntity) throw new PurchaseReturnNotFoundError(request.returnId);

    const row = returnEntity.toPrimitives();
    const [receipt, supplier, warehouse, items] = await Promise.all([
      this.receipts.find(tenantId, GoodsReceiptId.of(row.receiptId)),
      this.suppliers.find(tenantId, SupplierId.of(row.supplierId)),
      this.catalog.findWarehouses(tenantId, [WarehouseRef.of(row.warehouseId)]),
      this.catalog.findItems(tenantId, row.lines.map((l) => ItemRef.of(l.itemId))),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const warehouseObj = warehouse[0];

    return {
      id: row.id,
      code: row.code,
      supplier: { id: row.supplierId, name: supplier ? supplier.name() : row.supplierId },
      receipt: { id: row.receiptId, code: receipt ? receipt.code : row.receiptId },
      warehouse: { id: row.warehouseId, name: warehouseObj?.name ?? row.warehouseId },
      date: row.returnDate,
      reason: row.reason,
      notes: row.notes,
      status: row.status,
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      currency: {
        code: row.currency,
        symbol: row.currency === 'USD' ? '$' : 'Bs',
        exchangeRate: row.exchangeRate ?? 1,
      },
      lines: row.lines.map((l) => {
        const item = itemMap.get(l.itemId);
        const unit = item?.units.find((u) => u.unitId === l.unitId);
        return {
          id: l.id,
          lineNumber: l.lineNumber,
          receiptLineId: l.receiptLineId,
          itemId: l.itemId,
          sku: l.itemSku,
          itemName: l.itemName,
          unitId: l.unitId,
          unitAbbreviation: unit?.abbreviation ?? '',
          quantity: l.quantity,
          baseQuantity: l.baseQuantity,
          unitCost: l.unitCost,
          restoresMovementId: l.restoresMovementId,
        };
      }),
    };
  }
}
