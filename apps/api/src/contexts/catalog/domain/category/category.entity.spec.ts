import { describe, expect, it } from 'vitest';
import { LATER, NOW, TENANT_A, aCategory } from '../testing/catalog.mother.js';
import { CategoryName } from './category-name.vo.js';
import { Category } from './category.entity.js';

describe('Category', () => {
  it('is born active', () => {
    expect(aCategory().isActive()).toBe(true);
  });

  it('keeps its code and tenant through a round trip to primitives', () => {
    const category = aCategory();

    expect(Category.fromPrimitives(category.toPrimitives()).toPrimitives()).toEqual(category.toPrimitives());
    expect(category.toPrimitives()).toMatchObject({ tenantId: TENANT_A, code: 'CAT000001', createdAt: NOW });
  });

  it('updates its name and description and records when', () => {
    const category = aCategory();

    category.update(CategoryName.of('Refrescos'), '  Con gas  ', LATER);

    expect(category.toPrimitives()).toMatchObject({
      name: 'Refrescos',
      description: 'Con gas',
      updatedAt: LATER,
      createdAt: NOW,
    });
  });

  it('stores a blank description as null', () => {
    const category = aCategory();

    category.update(CategoryName.of('Bebidas'), '   ', LATER);

    expect(category.toPrimitives().description).toBeNull();
  });

  // Politica de no borrado: desactivar y reactivar, nunca desaparecer.
  it('can be deactivated and reactivated', () => {
    const category = aCategory();

    category.deactivate(LATER);
    expect(category.isActive()).toBe(false);

    category.activate(LATER);
    expect(category.isActive()).toBe(true);
  });
});
