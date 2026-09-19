import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { ensureBaseQuantitiesUnchanged } from '../../domain/adjustment/lines/unchanged-base-quantities.js';
import { AdjustmentConfirmation } from '../../domain/adjustment/posting/adjustment-confirmation.js';
import { AdjustmentPosting } from '../../domain/adjustment/posting/adjustment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class AdjustmentConfirmer {
  constructor(
    private readonly finder: AdjustmentFinder,
    private readonly factory: AdjustmentLineFactory,
    private readonly adjustments: AdjustmentRepository,
    private readonly posting: AdjustmentPosting,
    private readonly confirmation: AdjustmentConfirmation,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: { tenantId: string; adjustmentId: string; userId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const adjustment = await this.finder.find(tenantId, AdjustmentId.of(request.adjustmentId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    // El borrador pudo quedar viejo: se revalida con el catalogo de hoy antes de mover nada. Si el
    // articulo se desactivo, se rechaza; si su caja paso de 24 a 12, tambien, para que la persona
    // revise las cantidades y guarde el borrador. Si ya no es borrador, `update` lo rechaza.
    if (adjustment.currentStatus() === 'draft') {
      const primitives = adjustment.toPrimitives();
      const lines = await this.factory.lines(
        tenantId,
        primitives.lines.map(({ itemId, unitId, direction, quantity, unitCost }) => ({ itemId, unitId, direction, quantity, unitCost })),
        primitives.type,
      );

      ensureBaseQuantitiesUnchanged(adjustment.lines(), lines);
      adjustment.update(
        {
          warehouseId: await this.factory.warehouse(tenantId, primitives.warehouseId),
          date: adjustment.date(),
          type: primitives.type,
          notes: primitives.notes,
          lines,
        },
        now,
        today,
      );

      await this.adjustments.save(adjustment);
    }

    await this.posting.post(tenantId, adjustment.id, (locked, ledger) => this.confirmation.apply(locked, ledger, now, request.userId));
  }
}
