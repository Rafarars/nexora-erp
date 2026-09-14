import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchFinder } from '../../domain/dispatch/find/dispatch-finder.js';
import { DispatchLineFactory } from '../../domain/dispatch/lines/dispatch-line-factory.js';
import { DispatchNotEditableError } from '../../domain/errors/sales.errors.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { DispatchInput } from '../create-dispatch/dispatch-creator.js';

export interface DispatchUpdaterRequest extends DispatchInput {
  tenantId: string;
  dispatchId: string;
}

// Reemplaza fecha, notas y lineas del borrador. El pedido y la bodega no cambian.
export class DispatchUpdater {
  constructor(
    private readonly finder: DispatchFinder,
    private readonly orders: SalesOrderFinder,
    private readonly factory: DispatchLineFactory,
    private readonly dispatches: DispatchRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: DispatchUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const dispatch = await this.finder.find(tenantId, DispatchId.of(request.dispatchId));
    const now = this.clock.now();

    // Primero el estado: lo confirmado se rechaza aunque su pedido ya no admita despachos.
    if (dispatch.currentStatus() !== 'draft') throw new DispatchNotEditableError(dispatch.id.value, dispatch.currentStatus());

    const order = await this.orders.find(tenantId, dispatch.orderId);

    dispatch.update(
      {
        date: request.date ? SalesDate.of(request.date) : SalesDate.fromDate(now),
        notes: request.notes ?? null,
        lines: await this.factory.lines(tenantId, order, request.lines),
      },
      now,
    );
    await this.dispatches.save(dispatch);
  }
}
