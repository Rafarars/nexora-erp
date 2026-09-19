import { Clock } from '../../../../shared/domain/ports/clock.js';
import { AdjustmentId } from '../../domain/adjustment/adjustment.entity.js';
import { AdjustmentCancellation } from '../../domain/adjustment/posting/adjustment-cancellation.js';
import { AdjustmentPosting } from '../../domain/adjustment/posting/adjustment-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Pasa siempre por la publicacion, tambien para un borrador: asi dos anulaciones
// simultaneas se ejecutan en serie y la segunda ve el ajuste ya anulado.
export class AdjustmentCanceller {
  constructor(
    private readonly posting: AdjustmentPosting,
    private readonly cancellation: AdjustmentCancellation,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; adjustmentId: string; userId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), AdjustmentId.of(request.adjustmentId), (adjustment, ledger) =>
      this.cancellation.apply(adjustment, ledger, now, request.userId),
    );
  }
}
