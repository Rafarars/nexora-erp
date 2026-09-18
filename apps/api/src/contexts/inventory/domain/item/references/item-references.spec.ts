import { ItemReorderRules } from '../item-reorder-rules.js';
import { describe, expect, it } from 'vitest';
import {
  CategoryNotFoundError,
  InactiveReferenceError,
  MeasurementUnitNotFoundError,
  TaxNotFoundError,
} from '../../errors/item.errors.js';
import { CategoryRef, TaxRef } from '../../shared/references.vo.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
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
} from '../../testing/item.mother.js';
import { InMemoryCatalogReferences } from '../../../infrastructure/testing/in-memory-catalog-references.js';
import { ItemDetails } from '../item.entity.js';
import { ItemName } from '../item-name.vo.js';
import { Sku } from '../sku.vo.js';
import { ItemReferences } from './item-references.js';

function references() {
  return new ItemReferences(
    new InMemoryCatalogReferences(
      [aCategory(), aCategory({ id: CATEGORY_B, name: 'Vieja', active: false })],
      [aTax(), aTax({ id: TAX_B, tenantId: TENANT_B })],
      [
        aUnit(),
        aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja', active: false }),
        aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' }),
      ],
    ),
  );
}

const tenantA = TenantId.of(TENANT_A);

function details(overrides: Partial<ItemDetails> = {}): ItemDetails {
  const current = anItem().toPrimitives();

  return {
    sku: Sku.of(current.sku),
    barcode: null,
    name: ItemName.of(current.name),
    isPurchasable: true,
    isSellable: true,
    description: null,
    type: 'inventoried',
    categoryId: CategoryRef.of(current.categoryId!),
    salesTaxId: TaxRef.of(current.salesTaxId!),
    purchaseTaxId: TaxRef.of(current.salesTaxId!),
    units: baseUnitOnly(),
    reorderRules: ItemReorderRules.none(),
    ...overrides,
  };
}

describe('ItemReferences', () => {
  it('accepts active references of the same tenant', async () => {
    await expect(references().ensureAssignable(tenantA, details())).resolves.toBeUndefined();
  });

  it('accepts an item with no category and no tax', async () => {
    await expect(references().ensureAssignable(tenantA, details({ categoryId: null, salesTaxId: null, purchaseTaxId: null }))).resolves.toBeUndefined();
  });

  // Aislamiento: un identificador de otra empresa no existe para esta.
  it('treats a tax of another tenant as missing', async () => {
    await expect(references().ensureAssignable(tenantA, details({ salesTaxId: TaxRef.of(TAX_B) }))).rejects.toThrow(TaxNotFoundError);
  });

  it('treats a unit of another tenant as missing', async () => {
    await expect(references().ensureAssignable(tenantA, details({ units: baseUnitOnly(UNIT_KILO) }))).rejects.toThrow(
      MeasurementUnitNotFoundError,
    );
  });

  it('treats an unknown category as missing', async () => {
    await expect(
      references().ensureAssignable(tenantA, details({ categoryId: CategoryRef.of('99999999-9999-4999-8999-999999999999') })),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('refuses a new item pointing to an inactive category', async () => {
    await expect(references().ensureAssignable(tenantA, details({ categoryId: CategoryRef.of(CATEGORY_B) }))).rejects.toThrow(
      InactiveReferenceError,
    );
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
      references().ensureAssignable(tenantA, details({ categoryId: CategoryRef.of(CATEGORY_B), units: baseUnitOnly(UNIT_BOX) }), current),
    ).resolves.toBeUndefined();
  });

  it('does not let an edit switch to an inactive reference', async () => {
    await expect(references().ensureAssignable(tenantA, details({ categoryId: CategoryRef.of(CATEGORY_B) }), anItem())).rejects.toThrow(
      InactiveReferenceError,
    );
  });
});

describe('ItemReferences before reactivating an item', () => {
  it('accepts an item whose references are all active', async () => {
    await expect(references().ensureActive(tenantA, anItem())).resolves.toBeUndefined();
  });

  it('refuses an item whose category was deactivated', async () => {
    await expect(references().ensureActive(tenantA, anItem({ categoryId: CATEGORY_B }))).rejects.toThrow(InactiveReferenceError);
  });

  it('refuses an item that uses a deactivated unit', async () => {
    await expect(references().ensureActive(tenantA, anItem({ units: baseUnitOnly(UNIT_BOX) }))).rejects.toThrow(InactiveReferenceError);
  });
});
