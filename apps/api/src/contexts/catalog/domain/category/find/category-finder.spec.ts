import { describe, expect, it } from 'vitest';
import { InMemoryCategoryRepository } from '../../../infrastructure/testing/in-memory-category.repository.js';
import { CategoryNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CATEGORY_A, CATEGORY_B, TENANT_A, TENANT_B, aCategory } from '../../testing/catalog.mother.js';
import { CategoryId } from '../category-id.vo.js';
import { CategoryFinder } from './category-finder.js';

const finder = new CategoryFinder(
  new InMemoryCategoryRepository([aCategory(), aCategory({ id: CATEGORY_B, tenantId: TENANT_B })]),
);

describe('CategoryFinder', () => {
  it('returns the category of the tenant', async () => {
    expect((await finder.find(TenantId.of(TENANT_A), CategoryId.of(CATEGORY_A))).id.value).toBe(CATEGORY_A);
  });

  // Existe, pero en otra empresa: para esta no existe.
  it('treats a category of another tenant as missing', async () => {
    await expect(finder.find(TenantId.of(TENANT_A), CategoryId.of(CATEGORY_B))).rejects.toThrow(
      CategoryNotFoundError,
    );
  });
});
