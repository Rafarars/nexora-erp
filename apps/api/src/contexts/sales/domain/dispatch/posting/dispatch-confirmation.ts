import { SalesOrder } from '../../order/sales-order.entity.js';
import { Dispatch } from '../dispatch.entity.js';
import { DispatchPostingResult } from './dispatch-posting.js';

// Confirmar: el pedido registra lo despachado (y rechaza lo que supere lo pendiente), lo que
// libera esa reserva, y el inventario saca cada linea de la bodega del pedido.
export class DispatchConfirmation {
  apply(dispatch: Dispatch, order: SalesOrder, now: Date): DispatchPostingResult {
    dispatch.confirm(now);
    order.registerDispatch(
      dispatch.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      now,
    );

    return {
      dispatch,
      order,
      stock: {
        kind: 'release',
        exits: dispatch.lines().map((line) => ({
          lineId: line.id.value,
          itemId: line.itemId,
          warehouseId: dispatch.warehouseId,
          quantity: line.baseQuantity,
        })),
      },
    };
  }
}
