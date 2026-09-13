import { describe, expect, it } from 'vitest';
import { DuplicateCategoryNameError } from '../../domain/errors/duplicate.errors.js';
import { CategoryNotFoundError } from '../../domain/errors/not-found.errors.js';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CATEGORY_A, CATEGORY_B, TENANT_A, TENANT_B, aCategory } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { CategoryUpdater } from './category-updater.js';

const updaterFor = (s: CatalogScenario) => new CategoryUpdater(s.categoryFinder, s.categoryUniqueness, s.categories, s.clock);

describe('CategoryUpdater', () => {
  it('renames the category and keeps its code', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()] });

    await updaterFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, name: 'Refrescos', description: null });

    const category = await scenario.categories.find(TenantId.of(TENANT_A), CategoryId.of(CATEGORY_A));
    expect(category?.toPrimitives()).toMatchObject({ name: 'Refrescos', code: 'CAT000001' });
  });

  it('lets a category keep its own name', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ name: 'Bebidas' })] });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, name: 'Bebidas', description: 'Nueva' }),
    ).resolves.toBeUndefined();
  });

  it('refuses the name of another category', async () => {
    const scenario = aCatalogScenario({
      categories: [aCategory(), aCategory({ id: CATEGORY_B, name: 'Limpieza', code: 'CAT000002' })],
    });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_B, name: 'Bebidas' }),
    ).rejects.toThrow(DuplicateCategoryNameError);
  });

  // Aislamiento: editar la categoria de otra empresa responde como si no existiera.
  it('cannot reach a category of another tenant', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ tenantId: TENANT_B })] });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, name: 'Colado' }),
    ).rejects.toThrow(CategoryNotFoundError);
    expect((await scenario.categories.searchByTenant(TenantId.of(TENANT_B)))[0].toPrimitives().name).toBe('Bebidas');
  });
});
