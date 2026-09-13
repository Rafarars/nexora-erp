import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryName } from '../../domain/category/category-name.vo.js';
import { Category } from '../../domain/category/category.entity.js';
import { CategoryRepository } from '../../domain/category/category.repository.js';
import { CategoryUniqueness } from '../../domain/category/unique/category-uniqueness.js';
import { CatalogCode } from '../../domain/shared/catalog-code.vo.js';
import { CodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CategoryCreatorRequest } from './category-creator.request.js';

export class CategoryCreator {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly uniqueness: CategoryUniqueness,
    private readonly codes: CodeSequence,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: CategoryCreatorRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const name = CategoryName.of(request.name);

    await this.uniqueness.ensureNameIsFree(tenantId, name);

    // El numero se pide al final: una validacion que falle no consume correlativo.
    const code = CatalogCode.fromSequence(Category.CODE_PREFIX, await this.codes.next(tenantId, Category.CODE_PREFIX));

    await this.categories.save(
      Category.create(CategoryId.of(this.ids.next()), tenantId, code, name, request.description ?? null, this.clock.now()),
    );
  }
}
