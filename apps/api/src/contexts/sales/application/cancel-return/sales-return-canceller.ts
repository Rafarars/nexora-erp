import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SalesReturnPosting } from '../../domain/return/posting/sales-return-posting.js';
import { SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesReturnCancellerRequest {
  tenantId: string;
  returnId: string;
}

export class SalesReturnCanceller {
  constructor(
    private readonly posting: SalesReturnPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: SalesReturnCancellerRequest): Promise<SalesReturn> {
    const tenantId = TenantId.of(request.tenantId);
    const returnId = SalesReturnId.of(request.returnId);
    const now = this.clock.now();

    return this.posting.cancel(tenantId, returnId, now);
  }
}
