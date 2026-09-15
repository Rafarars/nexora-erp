import { ItemNotFoundError } from '../../errors/item.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ItemId } from '../item-id.vo.js';
import { Item } from '../item.entity.js';
import { ItemRepository } from '../item.repository.js';

export class ItemFinder {
  constructor(private readonly items: ItemRepository) {}

  async find(tenantId: TenantId, id: ItemId): Promise<Item> {
    const item = await this.items.find(tenantId, id);

    if (!item) {
      throw new ItemNotFoundError(id.value);
    }

    return item;
  }
}
