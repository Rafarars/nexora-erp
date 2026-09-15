import { TenantId } from '../shared/tenant-id.vo.js';
import { ItemId } from './item-id.vo.js';
import { Item } from './item.entity.js';
import { Sku } from './sku.vo.js';

export const ITEM_REPOSITORY = Symbol('ItemRepository');

export interface ItemRepository {
  // Lanza DuplicateSkuError si la base rechaza el SKU.
  save(item: Item): Promise<void>;
  find(tenantId: TenantId, id: ItemId): Promise<Item | null>;
  findBySku(tenantId: TenantId, sku: Sku): Promise<Item | null>;
  searchByTenant(tenantId: TenantId): Promise<Item[]>;
}
