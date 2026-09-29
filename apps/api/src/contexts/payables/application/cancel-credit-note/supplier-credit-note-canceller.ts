import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SupplierCreditNoteId } from '../../domain/credit-note/supplier-credit-note.entity.js';
import { SupplierCreditNotePosting } from '../../domain/credit-note/posting/supplier-credit-note-posting.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class SupplierCreditNoteCanceller {
  constructor(
    private readonly posting: SupplierCreditNotePosting,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; creditNoteId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const now = this.clock.now();

    await this.posting.cancel(tenantId, SupplierCreditNoteId.of(request.creditNoteId), now);
  }
}
