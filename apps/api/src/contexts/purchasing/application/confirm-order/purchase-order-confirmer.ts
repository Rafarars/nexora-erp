import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { DocumentRates } from '../../../../shared/domain/ports/document-rates.js';
import { PurchaseOrderFinder } from '../../domain/order/find/purchase-order-finder.js';
import { PurchaseOrderReferences } from '../../domain/order/lines/purchase-order-references.js';
import { ensureBaseQuantitiesUnchanged } from '../../domain/order/lines/unchanged-base-quantities.js';
import { ensureOrderMatchesCatalog } from '../../domain/order/posting/ordered-items-check.js';
import { PurchaseOrderPosting } from '../../domain/order/posting/purchase-order-posting.js';
import { PurchaseOrderId } from '../../domain/order/purchase-order.entity.js';
import { PurchaseOrderRepository } from '../../domain/order/purchase-order.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { orderDetails } from '../create-order/purchase-order-creator.js';

export class PurchaseOrderConfirmer {
  constructor(
    private readonly finder: PurchaseOrderFinder,
    private readonly references: PurchaseOrderReferences,
    private readonly orders: PurchaseOrderRepository,
    private readonly posting: PurchaseOrderPosting,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
    private readonly rates: DocumentRates,
  ) {}

  async run(request: { tenantId: string; orderId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const order = await this.finder.find(tenantId, PurchaseOrderId.of(request.orderId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // El borrador pudo quedar viejo: se revalida con el catalogo de hoy, conservando lo que la
    // persona escribio y la identidad de cada linea. Si el proveedor o un articulo se desactivo, se
    // rechaza; si la caja paso de 24 a 12, tambien, para que la persona revise y guarde la orden.
    if (order.currentStatus() === 'draft') {
      const row = order.toPrimitives();
      const details = await orderDetails(
        this.references,
        this.rates,
        tenantId,
        {
          supplierId: row.supplierId,
          warehouseId: row.warehouseId,
          date: row.orderDate,
          expectedDate: row.expectedDate,
          notes: row.notes,
          // Confirmar congela la tasa del dia de la orden, salvo la escrita a mano.
          currency: row.currency,
          exchangeRate: order.currency().manualRate(),
          lines: row.lines.map(({ id, itemId, unitId, quantity, unitCost }) => ({ id, itemId, unitId, quantity, unitCost })),
        },
        today,
        true,
      );

      ensureBaseQuantitiesUnchanged(order.lines(), details.lines);
      order.update(details, now, today);
      await this.orders.save(order);
    }

    await this.posting.post(tenantId, order.id, (locked, items) => {
      ensureOrderMatchesCatalog(locked, items);
      locked.confirm(now);
    });
  }
}
