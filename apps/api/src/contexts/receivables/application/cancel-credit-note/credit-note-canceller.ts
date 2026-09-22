import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CreditNoteId } from '../../domain/credit-note/customer-credit-note.entity.js';
import { CreditNotePosting } from '../../domain/credit-note/posting/credit-note-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class CreditNoteCanceller {
  constructor(
    private readonly posting: CreditNotePosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; creditNoteId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();

    await this.posting.cancel(tenantId, CreditNoteId.of(request.creditNoteId), now);
  }
}
