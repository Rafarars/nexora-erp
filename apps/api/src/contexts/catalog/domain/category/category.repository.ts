import { TenantId } from '../shared/tenant-id.vo.js';
import { CategoryId } from './category-id.vo.js';
import { CategoryName } from './category-name.vo.js';
import { Category } from './category.entity.js';

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');

// `save` lanza DuplicateCategoryNameError si la base rechaza el nombre: la
// comprobacion previa del dominio no cubre dos altas simultaneas.
export interface CategoryRepository {
  save(category: Category): Promise<void>;
  find(tenantId: TenantId, id: CategoryId): Promise<Category | null>;
  findByName(tenantId: TenantId, name: CategoryName): Promise<Category | null>;
  searchByTenant(tenantId: TenantId): Promise<Category[]>;
}
