import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { PurchasingCatalog } from '../../catalog/purchasing-catalog.js';
import {
  InactivePurchaseItemError,
  InactivePurchaseWarehouseError,
  InvalidPurchaseQuantityError,
  PurchaseItemNotFoundError,
  PurchaseOrderNotReceivableError,
  PurchaseWarehouseNotFoundError,
  ReceiptExceedsPendingError,
} from '../../errors/purchasing.errors.js';
import { PurchaseOrderLineId } from '../../order/purchase-order-line.js';
import { PurchaseOrder } from '../../order/purchase-order.entity.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { GoodsReceiptLine, GoodsReceiptLineId } from '../goods-receipt-line.js';

export interface GoodsReceiptLineInput {
  // Solo al revalidar un borrador: conserva la identidad de la linea.
  id?: string;
  orderLineId: string;
  quantity: number;
}

// Arma las lineas de una entrada a partir de su orden: cada una sale de una linea de la
// orden y no trae mas de lo pendiente. Su cantidad base es la proporcional de la linea de la
// orden, que es lo que la orden anuncio en camino: asi lo que entra cuadra con lo que llega. La
// orden se vuelve a comprobar, ya bloqueada, al confirmar.
export class GoodsReceiptLineFactory {
  constructor(
    private readonly catalog: PurchasingCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async lines(tenantId: TenantId, order: PurchaseOrder, inputs: GoodsReceiptLineInput[]): Promise<GoodsReceiptLine[]> {
    if (!order.isReceivable()) throw new PurchaseOrderNotReceivableError(order.id.value, order.currentStatus());

    const [warehouse] = await this.catalog.findWarehouses(tenantId, [order.warehouseId()]);

    if (!warehouse) throw new PurchaseWarehouseNotFoundError(order.warehouseId().value);
    if (!warehouse.isActive) throw new InactivePurchaseWarehouseError(warehouse.id);

    const orderLines = inputs.map((input) => order.line(PurchaseOrderLineId.of(input.orderLineId)));
    const items = await this.catalog.findItems(tenantId, [...new Map(orderLines.map((l) => [l.itemId.value, l.itemId])).values()]);

    return inputs.map((input, index) => {
      const orderLine = orderLines[index];
      const item = items.find((candidate) => candidate.id === orderLine.itemId.value);

      if (!item) throw new PurchaseItemNotFoundError(orderLine.itemId.value);
      if (!item.isActive) throw new InactivePurchaseItemError(item.id);

      const quantity = Quantity.of(input.quantity);
      const baseQuantity = orderLine.baseOf(quantity);

      if (quantity.isZero() || baseQuantity.isZero()) throw new InvalidPurchaseQuantityError(input.quantity);

      if (quantity.isGreaterThan(orderLine.pending())) {
        throw new ReceiptExceedsPendingError(orderLine.id.value, orderLine.pending().toNumber(), quantity.toNumber());
      }

      return GoodsReceiptLine.of({
        id: GoodsReceiptLineId.of(input.id ?? this.ids.next()),
        lineNumber: index + 1,
        orderLineId: orderLine.id,
        itemId: orderLine.itemId,
        itemSku: orderLine.itemSku,
        itemName: orderLine.itemName,
        unitId: orderLine.unitId,
        quantity,
        baseQuantity,
        unitCost: orderLine.unitCost,
      });
    });
  }
}
