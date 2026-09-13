import { describe, expect, it } from 'vitest';
import { InMemoryCategoryRepository } from '../../../infrastructure/testing/in-memory-category.repository.js';
import { InMemoryMeasurementUnitRepository } from '../../../infrastructure/testing/in-memory-measurement-unit.repository.js';
import { InMemoryTaxRepository } from '../../../infrastructure/testing/in-memory-tax.repository.js';
import { CategoryFinder } from '../../category/find/category-finder.js';
import { CategoryId } from '../../category/category-id.vo.js';
import { InactiveReferenceError } from '../../errors/inactive-reference.error.js';
import {
  CategoryNotFoundError,
  MeasurementUnitNotFoundError,
  TaxNotFoundError,
} from '../../errors/not-found.errors.js';
import { MeasurementUnitFinder } from '../../measurement-unit/find/measurement-unit-finder.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TaxFinder } from '../../tax/find/tax-finder.js';
import { TaxId } from '../../tax/tax-id.vo.js';
import {
  CATEGORY_B,
  TAX_B,
  TENANT_A,
  TENANT_B,
  UNIT_BOX,
  UNIT_KILO,
  aCategory,
  aTax,
  aUnit,
  anItem,
  baseUnitOnly,
} from '../../testing/catalog.mother.js';
import { ItemDetails } from '../item.entity.js';
import { ItemName } from '../item-name.vo.js';
import { Sku } from '../sku.vo.js';
import { ItemReferences } from './item-references.js';

function references() {
  return new ItemReferences(
    new CategoryFinder(
      new InMemoryCategoryRepository([
        aCategory(),
        aCategory({ id: CATEGORY_B, name: 'Vieja', code: 'CAT000002', active: false }),
      ]),
    ),
    new TaxFinder(new InMemoryTaxRepository([aTax(), aTax({ id: TAX_B, tenantId: TENANT_B })])),
    new MeasurementUnitFinder(
      new InMemoryMeasurementUnitRepository([
        aUnit(),
        aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja', active: false }),
        aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' }),
      ]),
    ),
  );
}

const tenantA = TenantId.of(TENANT_A);

function details(overrides: Partial<ItemDetails> = {}): ItemDetails {
  const current = anItem().toPrimitives();

  return {
    sku: Sku.of(current.sku),
    name: ItemName.of(current.name),
    description: null,
    type: 'inventoried',
    categoryId: CategoryId.of(current.categoryId!),
    taxId: TaxId.of(current.taxId!),
    units: baseUnitOnly(),
    ...overrides,
  };
}

describe('ItemReferences', () => {
  it('accepts active references of the same tenant', async () => {
    await expect(references().ensureAssignable(tenantA, details())).resolves.toBeUndefined();
  });

  it('accepts an item with no category and no tax', async () => {
    await expect(references().ensureAssignable(tenantA, details({ categoryId: null, taxId: null }))).resolves.toBeUndefined();
  });

  // Aislamiento: un identificador de otra empresa no existe para esta.
  it('treats a tax of another tenant as missing', async () => {
    await expect(references().ensureAssignable(tenantA, details({ taxId: TaxId.of(TAX_B) }))).rejects.toThrow(
      TaxNotFoundError,
    );
  });

  it('treats a unit of another tenant as missing', async () => {
    await expect(references().ensureAssignable(tenantA, details({ units: baseUnitOnly(UNIT_KILO) }))).rejects.toThrow(
      MeasurementUnitNotFoundError,
    );
  });

  it('treats an unknown category as missing', async () => {
    await expect(
      references().ensureAssignable(tenantA, details({ categoryId: CategoryId.of('99999999-9999-4999-8999-999999999999') })),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('refuses a new item pointing to an inactive category', async () => {
    await expect(
      references().ensureAssignable(tenantA, details({ categoryId: CategoryId.of(CATEGORY_B) })),
    ).rejects.toThrow(InactiveReferenceError);
  });

  it('refuses a new item using an inactive unit', async () => {
    await expect(references().ensureAssignable(tenantA, details({ units: baseUnitOnly(UNIT_BOX) }))).rejects.toThrow(
      InactiveReferenceError,
    );
  });

  // Corregir la descripcion no obliga a cambiar una categoria que se desactivo despues.
  it('lets an item keep an inactive reference it already had', async () => {
    const current = anItem({ categoryId: CATEGORY_B, units: baseUnitOnly(UNIT_BOX) });

    await expect(
      references().ensureAssignable(
        tenantA,
        details({ categoryId: CategoryId.of(CATEGORY_B), units: baseUnitOnly(UNIT_BOX) }),
        current,
      ),
    ).resolves.toBeUndefined();
  });

  it('does not let an edit switch to an inactive reference', async () => {
    await expect(
      references().ensureAssignable(tenantA, details({ categoryId: CategoryId.of(CATEGORY_B) }), anItem()),
    ).rejects.toThrow(InactiveReferenceError);
  });
});

describe('ItemReferences before reactivating an item', () => {
  it('accepts an item whose references are all active', async () => {
    await expect(references().ensureActive(tenantA, anItem())).resolves.toBeUndefined();
  });

  it('refuses an item whose category was deactivated', async () => {
    await expect(references().ensureActive(tenantA, anItem({ categoryId: CATEGORY_B }))).rejects.toThrow(
      InactiveReferenceError,
    );
  });

  it('refuses an item that uses a deactivated unit', async () => {
    await expect(references().ensureActive(tenantA, anItem({ units: baseUnitOnly(UNIT_BOX) }))).rejects.toThrow(
      InactiveReferenceError,
    );
  });
});
