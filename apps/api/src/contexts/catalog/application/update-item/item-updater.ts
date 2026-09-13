import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ItemFinder } from '../../domain/item/find/item-finder.js';
import { ItemDetailsInput, itemDetailsOf } from '../../domain/item/item-details.js';
import { ItemId } from '../../domain/item/item-id.vo.js';
import { ItemRepository } from '../../domain/item/item.repository.js';
import { ItemReferences } from '../../domain/item/references/item-references.js';
import { SkuUniqueness } from '../../domain/item/unique/sku-uniqueness.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ItemWithMovementsError } from '../../domain/errors/in-use.errors.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';

export interface ItemUpdaterRequest extends ItemDetailsInput {
  tenantId: string;
  itemId: string;
}

export class ItemUpdater {
  constructor(
    private readonly finder: ItemFinder,
    private readonly references: ItemReferences,
    private readonly skus: SkuUniqueness,
    private readonly stock: StockUsage,
    private readonly items: ItemRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: ItemUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const item = await this.finder.find(tenantId, ItemId.of(request.itemId));
    const details = itemDetailsOf(request);

    await this.references.ensureAssignable(tenantId, details, item);
    await this.skus.ensureIsFree(tenantId, details.sku, item.id);

    if (item.changesStockIdentity(details) && (await this.stock.itemHasMovements(tenantId, item.id))) {
      throw new ItemWithMovementsError(item.id.value);
    }

    item.update(details, this.clock.now());

    await this.items.save(item);
  }
}
