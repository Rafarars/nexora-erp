import { describe, expect, it } from 'vitest';
import { DuplicateTaxNameError } from '../../domain/errors/duplicate.errors.js';
import { InvalidTaxRateError } from '../../domain/errors/invalid-values.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, aTax } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { TaxCreator } from './tax-creator.js';

const creatorFor = (s: CatalogScenario) => new TaxCreator(s.taxes, s.taxUniqueness, s.codes, s.ids, s.clock);

describe('TaxCreator', () => {
  it('creates a tax with its rate', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'IVA reducido', rate: 8 });

    const [tax] = await scenario.taxes.searchByTenant(TenantId.of(TENANT_A));
    expect(tax.toPrimitives()).toMatchObject({ code: 'IMP000001', name: 'IVA reducido', rate: 8 });
  });

  it('accepts a rate of zero for exempt items', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Exento', rate: 0 });

    expect((await scenario.taxes.searchByTenant(TenantId.of(TENANT_A)))[0].toPrimitives().rate).toBe(0);
  });

  it('rejects a rate above 100', async () => {
    await expect(creatorFor(aCatalogScenario()).run({ tenantId: TENANT_A, name: 'Absurdo', rate: 101 })).rejects.toThrow(
      InvalidTaxRateError,
    );
  });

  it('rejects a repeated name', async () => {
    const scenario = aCatalogScenario({ taxes: [aTax({ name: 'IVA 16%' })] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'IVA 16%', rate: 16 })).rejects.toThrow(
      DuplicateTaxNameError,
    );
  });
});
