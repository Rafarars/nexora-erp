import { describe, expect, it } from 'vitest';
import { DuplicateMeasurementUnitAbbreviationError } from '../../domain/errors/duplicate.errors.js';
import { MeasurementUnitNotFoundError } from '../../domain/errors/not-found.errors.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, UNIT_BOX, UNIT_PIECE, aUnit } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { MeasurementUnitUpdater } from './measurement-unit-updater.js';

const updaterFor = (s: CatalogScenario) => new MeasurementUnitUpdater(s.unitFinder, s.unitUniqueness, s.units, s.clock);

describe('MeasurementUnitUpdater', () => {
  it('updates name and abbreviation', async () => {
    const scenario = aCatalogScenario({ units: [aUnit()] });

    await updaterFor(scenario).run({ tenantId: TENANT_A, unitId: UNIT_PIECE, name: 'Pieza', abbreviation: 'pz' });

    const unit = await scenario.units.find(TenantId.of(TENANT_A), MeasurementUnitId.of(UNIT_PIECE));
    expect(unit?.toPrimitives()).toMatchObject({ name: 'Pieza', abbreviation: 'pz' });
  });

  it('refuses the abbreviation of another unit', async () => {
    const scenario = aCatalogScenario({
      units: [aUnit(), aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja', code: 'UOM000002' })],
    });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, unitId: UNIT_BOX, name: 'Caja', abbreviation: 'un' }),
    ).rejects.toThrow(DuplicateMeasurementUnitAbbreviationError);
  });

  it('cannot reach a unit of another tenant', async () => {
    const scenario = aCatalogScenario({ units: [aUnit({ tenantId: TENANT_B })] });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, unitId: UNIT_PIECE, name: 'Colado', abbreviation: 'x' }),
    ).rejects.toThrow(MeasurementUnitNotFoundError);
  });
});
