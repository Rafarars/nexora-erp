import { describe, expect, it } from 'vitest';
import { MeasurementUnitInUseError } from '../../domain/errors/in-use.errors.js';
import { MeasurementUnitId } from '../../domain/measurement-unit/measurement-unit-id.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, UNIT_BOX, UNIT_PIECE, aUnit } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { MeasurementUnitStatusChanger } from './measurement-unit-status-changer.js';

const changerFor = (s: CatalogScenario) => new MeasurementUnitStatusChanger(s.unitFinder, s.usage, s.units, s.clock);

describe('MeasurementUnitStatusChanger', () => {
  // No solo la base: una unidad secundaria (la caja) tambien esta en uso.
  it('refuses to deactivate a unit that an active item uses as a secondary unit', async () => {
    const scenario = aCatalogScenario({ units: [aUnit(), aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja' })] });
    scenario.itemUsage.add({ unitIds: [UNIT_PIECE, UNIT_BOX] });

    await expect(changerFor(scenario).run({ tenantId: TENANT_A, unitId: UNIT_BOX, active: false })).rejects.toThrow(
      MeasurementUnitInUseError,
    );
  });

  it('deactivates and reactivates a unit nobody uses', async () => {
    const scenario = aCatalogScenario({ units: [aUnit()] });
    const changer = changerFor(scenario);
    const isActive = async () =>
      (await scenario.units.find(TenantId.of(TENANT_A), MeasurementUnitId.of(UNIT_PIECE)))?.isActive();

    await changer.run({ tenantId: TENANT_A, unitId: UNIT_PIECE, active: false });
    expect(await isActive()).toBe(false);

    await changer.run({ tenantId: TENANT_A, unitId: UNIT_PIECE, active: true });
    expect(await isActive()).toBe(true);
  });
});
