import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ItemStatusChangerRequest {
  tenantId: string;
  itemId: string;
  active: boolean;
}

// Desactivar un articulo con existencia quedara bloqueado en el H3, cuando exista.
export class ItemStatusChanger {
  constructor(
    private readonly finder: ItemFinder,
    private readonly references: ItemReferences,
    private readonly items: ItemRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: ItemStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const item = await this.finder.find(tenantId, ItemId.of(request.itemId));

    if (request.active) {
      await this.references.ensureActive(tenantId, item);
      item.activate(this.clock.now());
    } else {
      item.deactivate(this.clock.now());
    }

    await this.items.save(item);
  }
}
