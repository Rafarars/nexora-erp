import { describe, expect, it } from 'vitest';
import { InMemoryItemUsage } from '../../infrastructure/testing/in-memory-item-usage.js';
import { CategoryId } from '../category/category-id.vo.js';
import { CategoryInUseError, MeasurementUnitInUseError, TaxInUseError } from '../errors/in-use.errors.js';
import { MeasurementUnitId } from '../measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { TaxId } from '../tax/tax-id.vo.js';
import { CATEGORY_A, CATEGORY_B, TAX_A, TAX_B, TENANT_A, TENANT_B, UNIT_BOX, UNIT_PIECE } from '../testing/catalog.mother.js';
import { CatalogUsage } from './catalog-usage.js';

const tenantA = TenantId.of(TENANT_A);
const water = { categoryId: CATEGORY_A, taxId: TAX_A, unitIds: [UNIT_PIECE] };

describe('CatalogUsage', () => {
  it('refuses to free what an active item uses', async () => {
    const usage = new CatalogUsage(new InMemoryItemUsage([water]));

    await expect(usage.ensureCategoryIsUnused(tenantA, CategoryId.of(CATEGORY_A))).rejects.toThrow(CategoryInUseError);
    await expect(usage.ensureTaxIsUnused(tenantA, TaxId.of(TAX_A))).rejects.toThrow(TaxInUseError);
    await expect(usage.ensureUnitIsUnused(tenantA, MeasurementUnitId.of(UNIT_PIECE))).rejects.toThrow(MeasurementUnitInUseError);
  });

  // Un articulo inactivo no bloquea: ya no se ofrece en ningun documento.
  it('ignores inactive items', async () => {
    const usage = new CatalogUsage(new InMemoryItemUsage([{ ...water, isActive: false }]));

    await expect(usage.ensureCategoryIsUnused(tenantA, CategoryId.of(CATEGORY_A))).resolves.toBeUndefined();
    await expect(usage.ensureTaxIsUnused(tenantA, TaxId.of(TAX_A))).resolves.toBeUndefined();
    await expect(usage.ensureUnitIsUnused(tenantA, MeasurementUnitId.of(UNIT_PIECE))).resolves.toBeUndefined();
  });

  it('ignores items of another tenant', async () => {
    const usage = new CatalogUsage(new InMemoryItemUsage([{ ...water, tenantId: TENANT_B }]));

    await expect(usage.ensureCategoryIsUnused(tenantA, CategoryId.of(CATEGORY_A))).resolves.toBeUndefined();
  });

  it('lets free what nobody uses', async () => {
    const usage = new CatalogUsage(new InMemoryItemUsage([water]));

    await expect(usage.ensureCategoryIsUnused(tenantA, CategoryId.of(CATEGORY_B))).resolves.toBeUndefined();
    await expect(usage.ensureTaxIsUnused(tenantA, TaxId.of(TAX_B))).resolves.toBeUndefined();
    await expect(usage.ensureUnitIsUnused(tenantA, MeasurementUnitId.of(UNIT_BOX))).resolves.toBeUndefined();
  });
});
