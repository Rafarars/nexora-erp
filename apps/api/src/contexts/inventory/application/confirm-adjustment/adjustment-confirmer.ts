import { Clock } from '../../../../shared/domain/ports/clock.js';
import { AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
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
  ) {}

  async run(request: { tenantId: string; adjustmentId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const adjustment = await this.finder.find(tenantId, AdjustmentId.of(request.adjustmentId));
    const now = this.clock.now();

    // El borrador pudo quedar viejo: el articulo se desactivo, o su caja paso de 24 a 12.
    // Se revalida con el catalogo de hoy y se recalculan las cantidades base antes de mover
    // nada. Si ya no es borrador, `update` lo rechaza aqui mismo.
    if (adjustment.currentStatus() === 'draft') {
      const primitives = adjustment.toPrimitives();

      adjustment.update(
        {
          warehouseId: await this.factory.warehouse(tenantId, primitives.warehouseId),
          date: adjustment.date(),
          notes: primitives.notes,
          lines: await this.factory.lines(
            tenantId,
            primitives.lines.map(({ itemId, unitId, direction, quantity, unitCost }) => ({ itemId, unitId, direction, quantity, unitCost })),
          ),
        },
        now,
      );

      await this.adjustments.save(adjustment);
    }

    await this.posting.post(tenantId, adjustment.id, (locked, ledger) => this.confirmation.apply(locked, ledger, now));
  }
}
