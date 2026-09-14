import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { SalesCatalog } from '../../catalog/sales-catalog.js';
import {
  DispatchExceedsPendingError,
  InactiveSalesItemError,
  InactiveSalesWarehouseError,
  InvalidSalesQuantityError,
  SalesItemNotFoundError,
  SalesOrderNotDispatchableError,
  SalesWarehouseNotFoundError,
} from '../../errors/sales.errors.js';
import { SalesOrderLineId } from '../../order/sales-order-line.js';
import { SalesOrder } from '../../order/sales-order.entity.js';
import { Quantity } from '../../shared/quantity.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { DispatchLine, DispatchLineId } from '../dispatch-line.js';

export interface DispatchLineInput {
  // Solo al revalidar un borrador: conserva la identidad de la linea.
  id?: string;
  orderLineId: string;
  quantity: number;
}

// Arma las lineas de un despacho desde su pedido: cada una sale de una linea del pedido y no
// lleva mas de lo pendiente. La cantidad base es la proporcional de la linea del pedido, que es
// lo que el pedido reservo. Se vuelve a comprobar, con el pedido bloqueado, al confirmar.
export class DispatchLineFactory {
  constructor(
    private readonly catalog: SalesCatalog,
    private readonly ids: IdGenerator,
  ) {}

  async lines(tenantId: TenantId, order: SalesOrder, inputs: DispatchLineInput[]): Promise<DispatchLine[]> {
    if (!order.isDispatchable()) throw new SalesOrderNotDispatchableError(order.id.value, order.currentStatus());

    const [warehouse] = await this.catalog.findWarehouses(tenantId, [order.warehouseId()]);

    if (!warehouse) throw new SalesWarehouseNotFoundError(order.warehouseId().value);
    if (!warehouse.isActive) throw new InactiveSalesWarehouseError(warehouse.id);

    const orderLines = inputs.map((input) => order.line(SalesOrderLineId.of(input.orderLineId)));
    const items = await this.catalog.findItems(tenantId, [...new Map(orderLines.map((l) => [l.itemId.value, l.itemId])).values()]);

    return inputs.map((input, index) => {
      const orderLine = orderLines[index];
      const item = items.find((candidate) => candidate.id === orderLine.itemId.value);

      if (!item) throw new SalesItemNotFoundError(orderLine.itemId.value);
      if (!item.isActive) throw new InactiveSalesItemError(item.id);

      const quantity = Quantity.of(input.quantity);

      if (quantity.isZero()) throw new InvalidSalesQuantityError(input.quantity);

      if (quantity.isGreaterThan(orderLine.pending())) {
        throw new DispatchExceedsPendingError(orderLine.id.value, orderLine.pending().toNumber(), quantity.toNumber());
      }

      return DispatchLine.of({
        id: DispatchLineId.of(input.id ?? this.ids.next()),
        lineNumber: index + 1,
        orderLineId: orderLine.id,
        itemId: orderLine.itemId,
        unitId: orderLine.unitId,
        quantity,
        baseQuantity: orderLine.baseOf(quantity),
      });
    });
  }
}
