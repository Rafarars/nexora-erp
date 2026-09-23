import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { SalesCatalog } from '../../catalog/sales-catalog.js';
import { Dispatch } from '../../dispatch/dispatch.entity.js';
import {
  DispatchLineNotFoundError,
  InactiveSalesItemError,
  InactiveSalesWarehouseError,
  InvalidSalesQuantityError,
  QuantityExceedsDispatchedReturnQuotaError,
  SalesItemNotFoundError,
  SalesWarehouseNotFoundError,
  ServiceNotSellableError,
} from '../../errors/sales.errors.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { ItemRef, UnitRef, WarehouseRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesReturnLine, SalesReturnLineId } from '../sales-return-line.js';

export interface SalesReturnLineInput {
  id?: string;
  dispatchLineId?: string | null;
  quantity: number;
  itemId?: string;
  unitId?: string;
  unitCost?: number;
}

export interface OriginlessSalesReturnLineInput {
  id?: string;
  itemId: string;
  unitId: string;
  quantity: number;
  unitCost: number;
}

export class SalesReturnLineFactory {
  constructor(
    private readonly catalog: SalesCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async lines(
    tenantId: TenantId,
    dispatch: Dispatch,
    inputs: SalesReturnLineInput[],
    alreadyReturned: Map<string, number>,
  ): Promise<SalesReturnLine[]> {
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [dispatch.warehouseId]);
    if (!warehouse) throw new SalesWarehouseNotFoundError(dispatch.warehouseId.value);
    if (!warehouse.isActive) throw new InactiveSalesWarehouseError(warehouse.id);

    const dispatchLines = dispatch.lines();

    return inputs.map((input, index) => {
      const dispatchLine = dispatchLines.find((candidate) => candidate.id.value === input.dispatchLineId);
      if (!dispatchLine) throw new DispatchLineNotFoundError(input.dispatchLineId ?? '');

      const returned = alreadyReturned.get(dispatchLine.id.value) ?? 0;
      const available = Math.max(0, dispatchLine.quantity.toNumber() - returned);

      const quantity = Quantity.of(input.quantity);
      if (quantity.isZero() || input.quantity <= 0) throw new InvalidSalesQuantityError(input.quantity);

      if (input.quantity > available + 1e-6) {
        throw new QuantityExceedsDispatchedReturnQuotaError(dispatchLine.id.value, available, input.quantity);
      }

      // Proporcional a la unidad base despachada
      const factor = dispatchLine.baseQuantity.toNumber() / dispatchLine.quantity.toNumber();
      const baseQuantity = Quantity.of(Math.round(input.quantity * factor * 10000) / 10000);

      return SalesReturnLine.of({
        id: input.id ? SalesReturnLineId.of(input.id) : SalesReturnLineId.of(this.ids.next()),
        lineNumber: index + 1,
        dispatchLineId: dispatchLine.id.value,
        itemId: dispatchLine.itemId,
        itemSku: dispatchLine.itemSku,
        itemName: dispatchLine.itemName,
        unitId: dispatchLine.unitId,
        quantity,
        baseQuantity,
      });
    });
  }

  async originlessLines(
    tenantId: TenantId,
    warehouseId: WarehouseRef,
    inputs: OriginlessSalesReturnLineInput[],
  ): Promise<SalesReturnLine[]> {
    const [warehouse] = await this.catalog.findWarehouses(tenantId, [warehouseId]);
    if (!warehouse) throw new SalesWarehouseNotFoundError(warehouseId.value);
    if (!warehouse.isActive) throw new InactiveSalesWarehouseError(warehouse.id);

    const itemIds = [...new Set(inputs.map((i) => ItemRef.of(i.itemId)))];
    const items = await this.catalog.findItems(tenantId, itemIds);

    return inputs.map((input, index) => {
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new SalesItemNotFoundError(input.itemId);
      if (!item.isActive) throw new InactiveSalesItemError(input.itemId);
      if (item.type !== 'inventoried') throw new ServiceNotSellableError(input.itemId);

      const unit = item.units.find((u) => u.unitId === input.unitId);
      if (!unit) throw new InvalidSalesQuantityError(input.quantity);

      const quantity = Quantity.of(input.quantity);
      if (quantity.isZero() || input.quantity <= 0) throw new InvalidSalesQuantityError(input.quantity);

      if (input.unitCost < 0) throw new InvalidSalesQuantityError(input.unitCost);

      const baseQuantity = Quantity.of(Math.round(input.quantity * unit.conversionFactor * 10000) / 10000);

      return SalesReturnLine.of({
        id: input.id ? SalesReturnLineId.of(input.id) : SalesReturnLineId.of(this.ids.next()),
        lineNumber: index + 1,
        dispatchLineId: null,
        itemId: ItemRef.of(item.id),
        itemSku: item.sku,
        itemName: item.name,
        unitId: UnitRef.of(input.unitId),
        quantity,
        baseQuantity,
        unitCost: input.unitCost,
        restoresMovementId: null,
      });
    });
  }
}

