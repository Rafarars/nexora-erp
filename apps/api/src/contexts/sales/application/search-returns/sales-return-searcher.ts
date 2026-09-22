import { SalesCatalog } from '../../domain/catalog/sales-catalog.js';
import { CustomerRepository } from '../../domain/customer/customer.repository.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { CustomerNotFoundError, DispatchNotFoundError, SalesWarehouseNotFoundError } from '../../domain/errors/sales.errors.js';
import { ReturnCondition, SalesReturnStatus } from '../../domain/return/sales-return.entity.js';
import { SalesReturnRepository } from '../../domain/return/sales-return.repository.js';
import { CustomerId } from '../../domain/customer/customer.entity.js';
import { ItemRef, WarehouseRef } from '../../domain/shared/references.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesReturnLineResponse {
  id: string;
  lineNumber: number;
  dispatchLineId: string | null;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number | null;
  restoresMovementId: string | null;
}

export interface SalesReturnResponse {
  id: string;
  code: string;
  customer: { id: string; name: string };
  dispatch: { id: string; code: string } | null;
  warehouse: { id: string; name: string };
  date: string;
  condition: ReturnCondition;
  reason: string | null;
  notes: string | null;
  status: SalesReturnStatus;
  confirmedAt: string | null;
  cancelledAt: string | null;
  currency: {
    code: string;
    symbol: string;
    exchangeRate: number;
  };
  lines: SalesReturnLineResponse[];
}

export interface SalesReturnSearcherResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  returns: SalesReturnResponse[];
}

const DEFAULT_PAGE = 20;

export class SalesReturnSearcher {
  constructor(
    private readonly returns: SalesReturnRepository,
    private readonly dispatches: DispatchRepository,
    private readonly customers: CustomerRepository,
    private readonly catalog: SalesCatalog,
  ) {}

  async run(request: {
    tenantId: string;
    q?: string | null;
    customerId?: string | null;
    dispatchId?: string | null;
    status?: SalesReturnStatus | null;
    from?: string | null;
    to?: string | null;
    warehouseId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<SalesReturnSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);

    if (request.customerId && !(await this.customers.find(tenantId, CustomerId.of(request.customerId)))) {
      throw new CustomerNotFoundError(request.customerId);
    }
    if (request.dispatchId) {
      const found = await this.dispatches.find(tenantId, DispatchId.of(request.dispatchId));
      if (!found) throw new DispatchNotFoundError(request.dispatchId);
    }
    if (request.warehouseId) {
      const found = await this.catalog.findWarehouses(tenantId, [WarehouseRef.of(request.warehouseId)]);
      if (found.length === 0) throw new SalesWarehouseNotFoundError(request.warehouseId);
    }

    const limit = request.limit ?? DEFAULT_PAGE;
    const offset = request.offset ?? 0;
    const page = await this.returns.searchPage(tenantId, {
      customerId: request.customerId ?? undefined,
      dispatchId: request.dispatchId ?? undefined,
      status: request.status ?? undefined,
      from: request.from ?? undefined,
      to: request.to ?? undefined,
      text: request.q?.trim() ? request.q.trim() : undefined,
      limit,
      offset,
    });

    const rows = page.returns.map((r) => r.toPrimitives());

    const dispatchIds = [...new Set(rows.map((r) => r.dispatchId).filter((id): id is string => id !== null))];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];
    const itemIds = [...new Set(rows.flatMap((r) => r.lines.map((l) => l.itemId)))];

    const [dispatches, customers, items, warehouses] = await Promise.all([
      this.dispatches.searchByTenant(tenantId),
      this.customers.searchByTenant(tenantId),
      this.catalog.findItems(tenantId, itemIds.map((id) => ItemRef.of(id))),
      this.catalog.findWarehouses(tenantId, warehouseIds.map((id) => WarehouseRef.of(id))),
    ]);

    const dispatchMap = new Map(dispatches.map((d) => [d.id.value, d]));
    const customerMap = new Map(customers.map((c) => [c.id.value, c]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));


    const mappedReturns: SalesReturnResponse[] = rows.map((row) => {
      const dispatch = row.dispatchId ? dispatchMap.get(row.dispatchId) : null;
      const customer = customerMap.get(row.customerId);
      const warehouse = warehouseMap.get(row.warehouseId);

      return {
        id: row.id,
        code: row.code,
        customer: { id: row.customerId, name: customer ? customer.name() : row.customerId },
        dispatch: dispatch ? { id: dispatch.id.value, code: dispatch.code } : null,
        warehouse: { id: row.warehouseId, name: warehouse?.name ?? row.warehouseId },
        date: row.returnDate,
        condition: row.condition,
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
            dispatchLineId: l.dispatchLineId,
            itemId: l.itemId,
            sku: item?.sku ?? '',
            itemName: item?.name ?? '',
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
}
