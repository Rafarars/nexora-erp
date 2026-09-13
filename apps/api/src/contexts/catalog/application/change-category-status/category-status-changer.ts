import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryRepository } from '../../domain/category/category.repository.js';
import { CategoryFinder } from '../../domain/category/find/category-finder.js';
import { CatalogUsage } from '../../domain/item/usage/catalog-usage.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CategoryStatusChangerRequest {
  tenantId: string;
  categoryId: string;
  active: boolean;
}

export class CategoryStatusChanger {
  constructor(
    private readonly finder: CategoryFinder,
    private readonly usage: CatalogUsage,
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: CategoryStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const category = await this.finder.find(tenantId, CategoryId.of(request.categoryId));

    if (request.active) {
      category.activate(this.clock.now());
    } else {
      await this.usage.ensureCategoryIsUnused(tenantId, category.id);
      category.deactivate(this.clock.now());
    }

    await this.categories.save(category);
  }
}
