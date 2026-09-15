import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { PurchaseOrderReferences } from '../../domain/order/lines/purchase-order-references.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { PurchaseOrderInput, orderDetails } from '../create-order/purchase-order-creator.js';

export interface PurchaseOrderUpdaterRequest extends PurchaseOrderInput {
  tenantId: string;
  orderId: string;
}

// Reemplaza el borrador entero. Lo confirmado no se toca.
export class PurchaseOrderUpdater {
  constructor(
    private readonly finder: PurchaseOrderFinder,
    private readonly references: PurchaseOrderReferences,
    private readonly orders: PurchaseOrderRepository,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: PurchaseOrderUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const order = await this.finder.find(tenantId, PurchaseOrderId.of(request.orderId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Guardar el borrador refresca sus tasas. Conservar su moneda vale aunque se haya retirado.
    const keepsCurrency = (request.currency ?? '').trim().toUpperCase() === order.currency().currency;

    order.update(await orderDetails(this.references, this.rates, tenantId, request, today, keepsCurrency), now, today);
    await this.orders.save(order);
  }
}
