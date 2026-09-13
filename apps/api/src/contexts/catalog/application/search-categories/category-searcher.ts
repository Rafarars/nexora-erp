import { CategoryRepository } from '../../domain/category/category.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CategorySearcherResponse } from './category-searcher.response.js';

// Activas e inactivas: la pantalla del catalogo las muestra todas para poder
// reactivarlas. Los selectores filtran las activas del lado de la interfaz.
export class CategorySearcher {
  constructor(private readonly categories: CategoryRepository) {}

  async run(request: { tenantId: string }): Promise<CategorySearcherResponse> {
    const categories = await this.categories.searchByTenant(TenantId.of(request.tenantId));

    return {
      categories: categories
        .map((category) => {
          const { id, code, name, description, isActive } = category.toPrimitives();

          return { id, code, name, description, isActive };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
