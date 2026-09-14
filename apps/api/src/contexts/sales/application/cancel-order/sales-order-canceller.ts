import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SalesOrderPosting } from '../../domain/order/posting/sales-order-posting.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Anular libera la reserva: lo pendiente de un pedido anulado deja de contar.
export class SalesOrderCanceller {
  constructor(
    private readonly posting: SalesOrderPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; orderId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), SalesOrderId.of(request.orderId), (order) => order.cancel(now));
  }
}
