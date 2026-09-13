import { describe, expect, it } from 'vitest';
import { CategoryId } from '../../domain/category/category-id.vo.js';
import { CategoryInUseError } from '../../domain/errors/in-use.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { CATEGORY_A, TENANT_A, aCategory, anItem } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { CategoryStatusChanger } from './category-status-changer.js';

const changerFor = (s: CatalogScenario) => new CategoryStatusChanger(s.categoryFinder, s.usage, s.categories, s.clock);
const isActive = async (s: CatalogScenario) =>
  (await s.categories.find(TenantId.of(TENANT_A), CategoryId.of(CATEGORY_A)))?.isActive();

describe('CategoryStatusChanger', () => {
  it('deactivates a category no active item uses', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()] });

    await changerFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, active: false });

    expect(await isActive(scenario)).toBe(false);
  });

  it('refuses to deactivate a category an active item uses, and leaves it active', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()], items: [anItem()] });

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, active: false }),
    ).rejects.toThrow(CategoryInUseError);
    expect(await isActive(scenario)).toBe(true);
  });

  it('deactivates it once the item using it is inactive', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory()], items: [anItem({ active: false })] });

    await changerFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, active: false });

    expect(await isActive(scenario)).toBe(false);
  });

  it('reactivates a category', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ active: false })] });

    await changerFor(scenario).run({ tenantId: TENANT_A, categoryId: CATEGORY_A, active: true });

    expect(await isActive(scenario)).toBe(true);
  });
});
