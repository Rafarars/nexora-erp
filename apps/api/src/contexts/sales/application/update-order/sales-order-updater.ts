import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SalesOrderInput, salesOrderDetails } from '../create-order/sales-order-creator.js';

export interface SalesOrderUpdaterRequest extends SalesOrderInput {
  tenantId: string;
  orderId: string;
}

// Reemplaza el borrador entero. Lo confirmado no se toca.
export class SalesOrderUpdater {
  constructor(
    private readonly finder: SalesOrderFinder,
    private readonly references: SalesOrderReferences,
    private readonly orders: SalesOrderRepository,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: SalesOrderUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const order = await this.finder.find(tenantId, SalesOrderId.of(request.orderId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // Guardar el borrador refresca sus tasas. Conservar su moneda vale aunque se haya retirado.
    const keepsCurrency = (request.currency ?? '').trim().toUpperCase() === order.currency().currency;

    order.update(await salesOrderDetails(this.references, this.rates, tenantId, request, today, keepsCurrency), now, today);
    await this.orders.save(order);
  }
}
