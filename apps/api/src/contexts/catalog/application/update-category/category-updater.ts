import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryName } from '../../domain/category/category-name.vo.js';
import { CategoryRepository } from '../../domain/category/category.repository.js';
import { CategoryFinder } from '../../domain/category/find/category-finder.js';
import { CategoryUniqueness } from '../../domain/category/unique/category-uniqueness.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CategoryUpdaterRequest } from './category-updater.request.js';

export class CategoryUpdater {
  constructor(
    private readonly finder: CategoryFinder,
    private readonly uniqueness: CategoryUniqueness,
    private readonly categories: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: CategoryUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const category = await this.finder.find(tenantId, CategoryId.of(request.categoryId));
    const name = CategoryName.of(request.name);

    await this.uniqueness.ensureNameIsFree(tenantId, name, category.id);

    category.update(name, request.description ?? null, this.clock.now());

    await this.categories.save(category);
  }
}
