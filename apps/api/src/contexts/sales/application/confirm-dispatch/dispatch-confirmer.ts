import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
import { DispatchLineFactory } from '../../domain/dispatch/lines/dispatch-line-factory.js';
import { DispatchConfirmation } from '../../domain/dispatch/posting/dispatch-confirmation.js';
import { DispatchPosting } from '../../domain/dispatch/posting/dispatch-posting.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class DispatchConfirmer {
  constructor(
    private readonly finder: DispatchFinder,
    private readonly orders: SalesOrderFinder,
    private readonly factory: DispatchLineFactory,
    private readonly dispatches: DispatchRepository,
    private readonly posting: DispatchPosting,
    private readonly confirmation: DispatchConfirmation,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; dispatchId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const dispatch = await this.finder.find(tenantId, DispatchId.of(request.dispatchId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Se revalida el borrador contra el pedido y el catalogo de hoy, conservando sus lineas. Lo
    // pendiente se vuelve a comprobar con el pedido bloqueado, que es la comprobacion que cuenta.
    if (dispatch.currentStatus() === 'draft') {
      const order = await this.orders.find(tenantId, dispatch.orderId);

      dispatch.update(
        {
          date: dispatch.date(),
          currency: order.currency(),
          notes: dispatch.notes(),
          lines: await this.factory.lines(
            tenantId,
            order,
            dispatch.lines().map((line) => ({ id: line.id.value, orderLineId: line.orderLineId.value, quantity: line.quantity.toNumber() })),
          ),
        },
        now,
        today,
      );
      await this.dispatches.save(dispatch);
    }

    await this.posting.post(tenantId, dispatch.id, (locked, order) => this.confirmation.apply(locked, order, now));
  }
}
