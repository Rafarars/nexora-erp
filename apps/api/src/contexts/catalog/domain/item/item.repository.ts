import { CategoryId } from '../category/category-id.vo.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';
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
  // Preguntas y no listas: para decidir si algo se puede desactivar basta con saber si
  // hay al menos un articulo activo que lo use.
  hasActiveWithCategory(tenantId: TenantId, categoryId: CategoryId): Promise<boolean>;
  hasActiveWithTax(tenantId: TenantId, taxId: TaxId): Promise<boolean>;
  hasActiveWithUnit(tenantId: TenantId, unitId: MeasurementUnitId): Promise<boolean>;
}
