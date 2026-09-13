import { describe, expect, it } from 'vitest';
import { TAX_B, TENANT_A, aTax } from '../../domain/testing/catalog.mother.js';
import { aCatalogScenario } from '../testing/catalog-scenario.js';
import { TaxSearcher } from './tax-searcher.js';

describe('TaxSearcher', () => {
  it('lists the taxes with their rate as a number, sorted by name', async () => {
    const scenario = aCatalogScenario({
      taxes: [aTax({ name: 'IVA 16%', rate: 16 }), aTax({ id: TAX_B, name: 'Exento', rate: 0, code: 'IMP000002' })],
    });

    const { taxes } = await new TaxSearcher(scenario.taxes).run({ tenantId: TENANT_A });

    expect(taxes.map((tax) => [tax.name, tax.rate])).toEqual([
      ['Exento', 0],
      ['IVA 16%', 16],
    ]);
  });
});
