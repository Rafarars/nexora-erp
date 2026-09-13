import { CategoryNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CategoryId } from '../category-id.vo.js';
import { Category } from '../category.entity.js';
import { CategoryRepository } from '../category.repository.js';

export class CategoryFinder {
  constructor(private readonly categories: CategoryRepository) {}

  async find(tenantId: TenantId, id: CategoryId): Promise<Category> {
    const category = await this.categories.find(tenantId, id);

    if (!category) {
      throw new CategoryNotFoundError(id.value);
    }

    return category;
  }
}
