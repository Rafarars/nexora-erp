import { SalesOrder } from '../../order/sales-order.entity.js';
import { Dispatch } from '../dispatch.entity.js';
import { DispatchPostingResult } from './dispatch-posting.js';

// Anular: un borrador solo cambia de estado. Uno confirmado devuelve al pedido lo que le habia
// registrado (y con ello vuelve a reservar) y el inventario devuelve la existencia.
export class DispatchCancellation {
  apply(dispatch: Dispatch, order: SalesOrder, invoiced: boolean, now: Date): DispatchPostingResult {
    const wasConfirmed = dispatch.currentStatus() === 'confirmed';

    dispatch.cancel(invoiced, now);

    if (!wasConfirmed) return { dispatch, order, stock: { kind: 'none' } };

    order.revertDispatch(
      dispatch.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      now,
    );

    return { dispatch, order, stock: { kind: 'reverse' } };
  }
}
