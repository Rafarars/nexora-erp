import { DuplicateCategoryNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CategoryId } from '../category-id.vo.js';
import { CategoryName } from '../category-name.vo.js';
import { CategoryRepository } from '../category.repository.js';

export class CategoryUniqueness {
  constructor(private readonly categories: CategoryRepository) {}

  // `except` es el registro que se esta editando: conservar su propio nombre no choca.
  async ensureNameIsFree(tenantId: TenantId, name: CategoryName, except?: CategoryId): Promise<void> {
    const existing = await this.categories.findByName(tenantId, name);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateCategoryNameError(name.value, tenantId.value);
    }
  }
}
