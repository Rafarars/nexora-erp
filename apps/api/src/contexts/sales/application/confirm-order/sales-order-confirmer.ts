import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { SalesOrderPosting } from '../../domain/order/posting/sales-order-posting.js';
import { StockReservation } from '../../domain/order/posting/stock-reservation.js';
import { SalesOrderId } from '../../domain/order/sales-order.entity.js';
import { SalesOrderRepository } from '../../domain/order/sales-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { salesOrderDetails } from '../create-order/sales-order-creator.js';

export class SalesOrderConfirmer {
  constructor(
    private readonly finder: SalesOrderFinder,
    private readonly references: SalesOrderReferences,
    private readonly orders: SalesOrderRepository,
    private readonly posting: SalesOrderPosting,
    private readonly reservation: StockReservation,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; orderId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const order = await this.finder.find(tenantId, SalesOrderId.of(request.orderId));
    const now = this.clock.now();

    // El borrador pudo quedar viejo: el cliente se desactivo o la caja paso de 24 a 12. Se
    // revalida con el catalogo de hoy conservando la identidad de cada linea.
    if (order.currentStatus() === 'draft') {
      const row = order.toPrimitives();

      order.update(
        await salesOrderDetails(
          this.references,
          tenantId,
          {
            customerId: row.customerId,
            warehouseId: row.warehouseId,
            date: row.orderDate,
            notes: row.notes,
            lines: row.lines.map(({ id, itemId, unitId, quantity, unitPrice }) => ({ id, itemId, unitId, quantity, unitPrice })),
          },
          now,
        ),
        now,
      );
      await this.orders.save(order);
    }

    // La reserva se decide aqui dentro, con las existencias bloqueadas.
    await this.posting.post(tenantId, order.id, (locked, availability) => this.reservation.confirm(locked, availability, now));
  }
}
