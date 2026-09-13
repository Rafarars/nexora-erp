import { describe, expect, it } from 'vitest';
import { CATEGORY_B, TENANT_A, TENANT_B, aCategory } from '../../domain/testing/catalog.mother.js';
import { aCatalogScenario } from '../testing/catalog-scenario.js';
import { CategorySearcher } from './category-searcher.js';

describe('CategorySearcher', () => {
  it('lists active and inactive categories of the tenant, sorted by name', async () => {
    const scenario = aCatalogScenario({
      categories: [
        aCategory({ name: 'Limpieza' }),
        aCategory({ id: CATEGORY_B, name: 'Bebidas', code: 'CAT000002', active: false }),
      ],
    });

    const { categories } = await new CategorySearcher(scenario.categories).run({ tenantId: TENANT_A });

    expect(categories).toEqual([
      { id: CATEGORY_B, code: 'CAT000002', name: 'Bebidas', description: null, isActive: false },
      { id: expect.any(String), code: 'CAT000001', name: 'Limpieza', description: null, isActive: true },
    ]);
  });

  it('never lists a category of another tenant', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ tenantId: TENANT_B })] });

    expect(await new CategorySearcher(scenario.categories).run({ tenantId: TENANT_A })).toEqual({ categories: [] });
  });
});
