import { describe, expect, it } from 'vitest';
import {
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
} from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, aUnit } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { MeasurementUnitCreator } from './measurement-unit-creator.js';

const creatorFor = (s: CatalogScenario) => new MeasurementUnitCreator(s.units, s.unitUniqueness, s.codes, s.ids, s.clock);

describe('MeasurementUnitCreator', () => {
  it('creates a unit with its code', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Caja', abbreviation: 'cja' });

    const [unit] = await scenario.units.searchByTenant(TenantId.of(TENANT_A));
    expect(unit.toPrimitives()).toMatchObject({ code: 'UOM000001', name: 'Caja', abbreviation: 'cja', isActive: true });
  });

  it('rejects a repeated name', async () => {
    const scenario = aCatalogScenario({ units: [aUnit()] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Unidad', abbreviation: 'ud' })).rejects.toThrow(
      DuplicateMeasurementUnitNameError,
    );
  });

  it('rejects a repeated abbreviation', async () => {
    const scenario = aCatalogScenario({ units: [aUnit()] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Pieza', abbreviation: 'un' })).rejects.toThrow(
      DuplicateMeasurementUnitAbbreviationError,
    );
  });

  it('rejects an abbreviation with spaces before touching anything', async () => {
    const scenario = aCatalogScenario();

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Caja', abbreviation: 'c ja' })).rejects.toThrow(
      /spaces/,
    );
    expect(await scenario.units.searchByTenant(TenantId.of(TENANT_A))).toEqual([]);
  });
});
