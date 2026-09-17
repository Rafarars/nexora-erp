import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { SalesOrderFinder } from '../../domain/order/find/sales-order-finder.js';
import { SalesOrderReferences } from '../../domain/order/lines/sales-order-references.js';
import { ensureBaseQuantitiesUnchanged } from '../../domain/order/lines/unchanged-base-quantities.js';
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
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; orderId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const order = await this.finder.find(tenantId, SalesOrderId.of(request.orderId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // El borrador pudo quedar viejo: se revalida con el catalogo de hoy conservando la identidad de
    // cada linea. Si el cliente o un articulo se desactivo, se rechaza; si la caja paso de 24 a 12,
    // tambien, para que la persona revise y guarde el pedido.
    if (order.currentStatus() === 'draft') {
      const row = order.toPrimitives();
      const details = await salesOrderDetails(
        this.references,
        this.rates,
        tenantId,
        {
          customerId: row.customerId,
          warehouseId: row.warehouseId,
          date: row.orderDate,
          notes: row.notes,
          currency: row.currency,
          // Confirmar congela la tasa del dia del pedido, salvo la escrita a mano.
          exchangeRate: order.currency().manualRate(),
          lines: row.lines.map(({ id, itemId, unitId, quantity, unitPrice }) => ({ id, itemId, unitId, quantity, unitPrice })),
        },
        today,
        true,
      );

      ensureBaseQuantitiesUnchanged(order.lines(), details.lines);
      order.update(details, now, today);
      await this.orders.save(order);
    }

    // La reserva se decide aqui dentro, con las existencias bloqueadas.
    await this.posting.post(tenantId, order.id, (locked, availability) => this.reservation.confirm(locked, availability, now));
  }
}
