import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemWithStockError } from '../../domain/errors/in-use.errors.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';

export interface ItemStatusChangerRequest {
  tenantId: string;
  itemId: string;
  active: boolean;
}

export class ItemStatusChanger {
  constructor(
    private readonly finder: ItemFinder,
    private readonly references: ItemReferences,
    private readonly stock: StockUsage,
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
      if (await this.stock.itemHasStock(tenantId, item.id)) {
        throw new ItemWithStockError(item.id.value);
      }

      item.deactivate(this.clock.now());
    }

    await this.items.save(item);
  }
}
