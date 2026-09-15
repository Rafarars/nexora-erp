import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ensureCanDeactivate } from '../../domain/item/commitments/item-commitments.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemPosting } from '../../domain/item/posting/item-posting.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ItemStatusChangerRequest {
  tenantId: string;
  itemId: string;
  active: boolean;
}

export class ItemStatusChanger {
  constructor(
    private readonly finder: ItemFinder,
    private readonly references: ItemReferences,
    private readonly posting: ItemPosting,
    private readonly clock: Clock,
  ) {}

  async run(request: ItemStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const item = await this.finder.find(tenantId, ItemId.of(request.itemId));
    const now = this.clock.now();

    if (request.active) {
      await this.references.ensureActive(tenantId, item);
      await this.posting.post(tenantId, item.id, (locked) => locked.activate(now));

      return;
    }

    await this.posting.post(tenantId, item.id, (locked, commitments) => {
      ensureCanDeactivate(locked, commitments);
      locked.deactivate(now);
    });
  }
}
