import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { Dispatch, DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchRepository } from '../../domain/dispatch/dispatch.repository.js';
import { DispatchLineFactory, DispatchLineInput } from '../../domain/dispatch/lines/dispatch-line-factory.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesCodeSequence, salesCode } from '../../domain/shared/code-sequence.js';
import { SalesDate } from '../../domain/shared/sales-date.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface DispatchInput {
  date?: string | null;
  notes?: string | null;
  lines: DispatchLineInput[];
}

export interface DispatchCreatorRequest extends DispatchInput {
  tenantId: string;
  orderId: string;
}

// Un borrador de lo que sale de un pedido: todavia no mueve existencia ni el pedido.
export class DispatchCreator {
  constructor(
    private readonly orders: SalesOrderFinder,
    private readonly factory: DispatchLineFactory,
    private readonly dispatches: DispatchRepository,
    private readonly codes: SalesCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: DispatchCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const order = await this.orders.find(tenantId, SalesOrderId.of(request.orderId));
    const details = {
      date: request.date ? SalesDate.of(request.date) : SalesDate.of(today),
      notes: request.notes ?? null,
      lines: await this.factory.lines(tenantId, order, request.lines),
    };
    const id = DispatchId.of(this.ids.next());
    const target = { id: order.id, warehouseId: order.warehouseId(), date: order.orderDate() };

    Dispatch.draft(id, tenantId, salesCode('DES', 0), target, details, now, today);

    const code = salesCode('DES', await this.codes.next(tenantId, 'DES'));

    await this.dispatches.save(Dispatch.draft(id, tenantId, code, target, details, now, today));
  }
}
