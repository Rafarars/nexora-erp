import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SalesReturnPosting } from '../../domain/return/posting/sales-return-posting.js';
import { SalesReturn, SalesReturnId } from '../../domain/return/sales-return.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SalesReturnConfirmerRequest {
  tenantId: string;
  returnId: string;
}

export class SalesReturnConfirmer {
  constructor(
    private readonly posting: SalesReturnPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: SalesReturnConfirmerRequest): Promise<SalesReturn> {
    const tenantId = TenantId.of(request.tenantId);
    const returnId = SalesReturnId.of(request.returnId);
    const now = this.clock.now();

    return this.posting.confirm(tenantId, returnId, now);
  }
}
