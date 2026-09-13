import { describe, expect, it } from 'vitest';
import { TENANT_A, TENANT_B, UNIT_KILO, aUnit } from '../../domain/testing/catalog.mother.js';
import { aCatalogScenario } from '../testing/catalog-scenario.js';
import { MeasurementUnitSearcher } from './measurement-unit-searcher.js';

describe('MeasurementUnitSearcher', () => {
  it('lists the units of the tenant only', async () => {
    const scenario = aCatalogScenario({
      units: [aUnit(), aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' })],
    });

    const { units } = await new MeasurementUnitSearcher(scenario.units).run({ tenantId: TENANT_A });

    expect(units).toEqual([
      { id: expect.any(String), code: 'UOM000001', name: 'Unidad', abbreviation: 'un', isActive: true },
    ]);
  });
});
