import { describe, expect, it } from 'vitest';
import { InMemoryCategoryRepository } from '../../../infrastructure/testing/in-memory-category.repository.js';
import { DuplicateCategoryNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CATEGORY_A, CATEGORY_B, TENANT_A, TENANT_B, aCategory } from '../../testing/catalog.mother.js';
import { CategoryId } from '../category-id.vo.js';
import { CategoryName } from '../category-name.vo.js';
import { CategoryUniqueness } from './category-uniqueness.js';

const uniqueness = new CategoryUniqueness(new InMemoryCategoryRepository([aCategory({ name: 'Bebidas' })]));

describe('CategoryUniqueness', () => {
  it('rejects a name already used in the tenant', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), CategoryName.of('Bebidas')),
    ).rejects.toThrow(DuplicateCategoryNameError);
  });

  it('accepts a name that is free', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), CategoryName.of('Limpieza'))).resolves.toBeUndefined();
  });

  // Cada empresa tiene su propio catalogo.
  it('accepts the same name in another tenant', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_B), CategoryName.of('Bebidas'))).resolves.toBeUndefined();
  });

  it('lets a category keep its own name while being edited', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), CategoryName.of('Bebidas'), CategoryId.of(CATEGORY_A)),
    ).resolves.toBeUndefined();
  });

  it('does not let another category take that name on edit', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), CategoryName.of('Bebidas'), CategoryId.of(CATEGORY_B)),
    ).rejects.toThrow(DuplicateCategoryNameError);
  });
});
