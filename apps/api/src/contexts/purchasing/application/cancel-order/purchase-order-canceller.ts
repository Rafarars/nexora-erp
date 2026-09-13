import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Con la orden bloqueada: si una entrada la esta recibiendo en ese instante, la anulacion
// espera y la ve ya recibida.
export class PurchaseOrderCanceller {
  constructor(
    private readonly posting: PurchaseOrderPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; orderId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), PurchaseOrderId.of(request.orderId), (order) => order.cancel(now));
  }
}
