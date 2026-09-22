import { Clock } from '../../../../shared/domain/ports/clock.js';
import { PurchaseReturnPosting } from '../../domain/return/posting/purchase-return-posting.js';
import { PurchaseReturn, PurchaseReturnId } from '../../domain/return/purchase-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface PurchaseReturnCancellerRequest {
  tenantId: string;
  returnId: string;
}

export class PurchaseReturnCanceller {
  constructor(
    private readonly posting: PurchaseReturnPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: PurchaseReturnCancellerRequest): Promise<PurchaseReturn> {
    const tenantId = TenantId.of(request.tenantId);
    const returnId = PurchaseReturnId.of(request.returnId);
    const now = this.clock.now();

    return this.posting.cancel(tenantId, returnId, now);
  }
}
