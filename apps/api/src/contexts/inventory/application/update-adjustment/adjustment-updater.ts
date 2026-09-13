import { Clock } from '../../../../shared/domain/ports/clock.js';
import { AdjustmentDate } from '../../domain/adjustment/adjustment-date.vo.js';
import { AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentFinder } from '../../domain/adjustment/find/adjustment-finder.js';
import { AdjustmentLineFactory } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { AdjustmentInput } from '../create-adjustment/adjustment-creator.js';

export interface AdjustmentUpdaterRequest extends AdjustmentInput {
  tenantId: string;
  adjustmentId: string;
}

// Reemplaza el borrador entero: bodega, fecha, notas y lineas. Lo confirmado no se toca.
export class AdjustmentUpdater {
  constructor(
    private readonly finder: AdjustmentFinder,
    private readonly factory: AdjustmentLineFactory,
    private readonly adjustments: AdjustmentRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: AdjustmentUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const adjustment = await this.finder.find(tenantId, AdjustmentId.of(request.adjustmentId));
    const now = this.clock.now();

    adjustment.update(
      {
        warehouseId: await this.factory.warehouse(tenantId, request.warehouseId),
        date: request.date ? AdjustmentDate.of(request.date) : AdjustmentDate.fromDate(now),
        notes: request.notes ?? null,
        lines: await this.factory.lines(tenantId, request.lines),
      },
      now,
    );

    await this.adjustments.save(adjustment);
  }
}
