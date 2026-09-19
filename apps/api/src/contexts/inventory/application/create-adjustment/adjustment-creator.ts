import { Clock } from '../../../../shared/domain/ports/clock.js';
import { BusinessCalendar } from '../../../../shared/domain/ports/business-calendar.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { AdjustmentDate } from '../../domain/adjustment/adjustment-date.vo.js';
import { Adjustment, AdjustmentId, adjustmentTypeOf } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentLineFactory, AdjustmentLineInput } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { InventoryCodeSequence, documentCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface AdjustmentInput {
  warehouseId: string;
  type: string;
  date?: string | null;
  notes?: string | null;
  lines: AdjustmentLineInput[];
}

export interface AdjustmentCreatorRequest extends AdjustmentInput {
  tenantId: string;
  userId: string;
}

// Crea un borrador: todavia no mueve nada. La fecha, si no se da, es la de hoy.
export class AdjustmentCreator {
  constructor(
    private readonly factory: AdjustmentLineFactory,
    private readonly adjustments: AdjustmentRepository,
    private readonly codes: InventoryCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly calendar: BusinessCalendar,
  ) {}

  async run(request: AdjustmentCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const today = await this.calendar.today(request.tenantId);
    const date = request.date ? AdjustmentDate.of(request.date) : AdjustmentDate.of(today);
    const warehouseId = await this.factory.warehouse(tenantId, request.warehouseId);
    const type = adjustmentTypeOf(request.type);
    const lines = await this.factory.lines(tenantId, request.lines, type);
    const details = { warehouseId, date, type, notes: request.notes ?? null, lines };
    const id = AdjustmentId.of(this.ids.next());

    // Se valida entero antes de pedir el numero: un borrador invalido no gasta correlativo.
    Adjustment.draft(id, tenantId, documentCode('AJU', 0), details, now, today, request.userId);

    const code = documentCode('AJU', await this.codes.next(tenantId, 'AJU'));

    await this.adjustments.save(Adjustment.draft(id, tenantId, code, details, now, today, request.userId));
  }
}
