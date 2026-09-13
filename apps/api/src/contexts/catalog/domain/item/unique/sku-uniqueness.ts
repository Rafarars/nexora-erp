import { DuplicateSkuError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ItemId } from '../item-id.vo.js';
import { ItemRepository } from '../item.repository.js';
import { Sku } from '../sku.vo.js';

export class SkuUniqueness {
  constructor(private readonly items: ItemRepository) {}

  async ensureIsFree(tenantId: TenantId, sku: Sku, except?: ItemId): Promise<void> {
    const existing = await this.items.findBySku(tenantId, sku);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateSkuError(sku.value, tenantId.value);
    }
  }
}
