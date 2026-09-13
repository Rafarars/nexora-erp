import { describe, expect, it } from 'vitest';
import { DuplicateCategoryNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, aCategory } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { CategoryCreator } from './category-creator.js';

const creatorFor = (s: CatalogScenario) => new CategoryCreator(s.categories, s.categoryUniqueness, s.codes, s.ids, s.clock);

describe('CategoryCreator', () => {
  it('creates an active category with the next code of its tenant', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Bebidas', description: 'Frías' });

    const [category] = await scenario.categories.searchByTenant(TenantId.of(TENANT_A));
    expect(category.toPrimitives()).toMatchObject({
      code: 'CAT000001',
      name: 'Bebidas',
      description: 'Frías',
      isActive: true,
    });
  });

  // Cada empresa lleva su propia numeracion.
  it('numbers each tenant independently', async () => {
    const scenario = aCatalogScenario();
    const creator = creatorFor(scenario);

    await creator.run({ tenantId: TENANT_A, name: 'Bebidas' });
    await creator.run({ tenantId: TENANT_A, name: 'Limpieza' });
    await creator.run({ tenantId: TENANT_B, name: 'Bebidas' });

    const codesOf = async (tenant: string) =>
      (await scenario.categories.searchByTenant(TenantId.of(tenant))).map((category) => category.code.value).sort();

    expect(await codesOf(TENANT_A)).toEqual(['CAT000001', 'CAT000002']);
    expect(await codesOf(TENANT_B)).toEqual(['CAT000001']);
  });

  it('rejects a name already used in the tenant', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ name: 'Bebidas' })] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Bebidas' })).rejects.toThrow(
      DuplicateCategoryNameError,
    );
  });

  // Una validacion que falla no gasta un numero de la secuencia.
  it('does not consume a code when the name is taken', async () => {
    const scenario = aCatalogScenario({ categories: [aCategory({ name: 'Bebidas' })] });

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Bebidas' }).catch(() => undefined);

    expect(await scenario.codes.next(TenantId.of(TENANT_A), 'CAT')).toBe(1);
  });

  it('rejects an empty name', async () => {
    await expect(creatorFor(aCatalogScenario()).run({ tenantId: TENANT_A, name: '  ' })).rejects.toThrow(/empty/);
  });
});
