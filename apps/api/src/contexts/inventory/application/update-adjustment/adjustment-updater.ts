import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { AdjustmentDate } from '../../domain/adjustment/adjustment-date.vo.js';
import { AdjustmentId, adjustmentTypeOf } from '../../domain/adjustment/adjustment.entity.js';
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
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: AdjustmentUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const adjustment = await this.finder.find(tenantId, AdjustmentId.of(request.adjustmentId));
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);

    const type = adjustmentTypeOf(request.type);

    adjustment.update(
      {
        warehouseId: await this.factory.warehouse(tenantId, request.warehouseId),
        date: request.date ? AdjustmentDate.of(request.date) : AdjustmentDate.of(today),
        type,
        notes: request.notes ?? null,
        lines: await this.factory.lines(tenantId, request.lines, type),
      },
      now,
      today,
    );

    await this.adjustments.save(adjustment);
  }
}
