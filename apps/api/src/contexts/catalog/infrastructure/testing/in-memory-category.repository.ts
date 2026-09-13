import { ensureUniqueCode } from './unique-code.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryName } from '../../domain/category/category-name.vo.js';
import { Category, CategoryPrimitives } from '../../domain/category/category.entity.js';
import { CategoryRepository } from '../../domain/category/category.repository.js';
import { DuplicateCategoryNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Imita las restricciones de la base, incluida la unicidad: si el doble aceptara lo que
// PostgreSQL rechaza, las pruebas de aplicacion pasarian con un comportamiento falso.
export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly rows = new Map<string, CategoryPrimitives>();

  constructor(seed: Category[] = []) {
    seed.forEach((category) => this.rows.set(category.id.value, category.toPrimitives()));
  }

  async save(category: Category): Promise<void> {
    const row = category.toPrimitives();
    ensureUniqueCode([...this.rows.values()], row);
    const clash = [...this.rows.values()].find(
      (other) => other.id !== row.id && other.tenantId === row.tenantId && other.name === row.name,
    );

    if (clash) throw new DuplicateCategoryNameError(row.name, row.tenantId);

    this.rows.set(row.id, row);
  }

  async find(tenantId: TenantId, id: CategoryId): Promise<Category | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? Category.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: CategoryName): Promise<Category | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.tenantId === tenantId.value && candidate.name === name.value,
    );

    return row ? Category.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<Category[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((row) => Category.fromPrimitives(row));
  }
}
