import { Clock } from '../../../../shared/domain/ports/clock.js';
import { DispatchId } from '../../domain/dispatch/dispatch.entity.js';
import { DispatchCancellation } from '../../domain/dispatch/posting/dispatch-cancellation.js';
import { DispatchPosting } from '../../domain/dispatch/posting/dispatch-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Siempre por la publicacion, tambien un borrador: dos anulaciones simultaneas van en fila.
export class DispatchCanceller {
  constructor(
    private readonly posting: DispatchPosting,
    private readonly cancellation: DispatchCancellation,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; dispatchId: string }): Promise<void> {
    const now = this.clock.now();

    await this.posting.post(TenantId.of(request.tenantId), DispatchId.of(request.dispatchId), (dispatch, order, invoiced) =>
      this.cancellation.apply(dispatch, order, invoiced, now),
    );
  }
}
