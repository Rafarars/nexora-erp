import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { AdjustmentDate } from '../../domain/adjustment/adjustment-date.vo.js';
import { Adjustment, AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { AdjustmentLineFactory, AdjustmentLineInput } from '../../domain/adjustment/lines/adjustment-line-factory.js';
import { InventoryCodeSequence, documentCode } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface AdjustmentInput {
  warehouseId: string;
  date?: string | null;
  notes?: string | null;
  lines: AdjustmentLineInput[];
}

export interface AdjustmentCreatorRequest extends AdjustmentInput {
  tenantId: string;
}

// Crea un borrador: todavia no mueve nada. La fecha, si no se da, es la de hoy.
export class AdjustmentCreator {
  constructor(
    private readonly factory: AdjustmentLineFactory,
    private readonly adjustments: AdjustmentRepository,
    private readonly codes: InventoryCodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: AdjustmentCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();
    const date = request.date ? AdjustmentDate.of(request.date) : AdjustmentDate.fromDate(now);
    const warehouseId = await this.factory.warehouse(tenantId, request.warehouseId);
    const lines = await this.factory.lines(tenantId, request.lines);
    const details = { warehouseId, date, notes: request.notes ?? null, lines };
    const id = AdjustmentId.of(this.ids.next());

    // Se valida entero antes de pedir el numero: un borrador invalido no gasta correlativo.
    Adjustment.draft(id, tenantId, documentCode('AJU', 0), details, now);

    const code = documentCode('AJU', await this.codes.next(tenantId, 'AJU'));

    await this.adjustments.save(Adjustment.draft(id, tenantId, code, details, now));
  }
}
