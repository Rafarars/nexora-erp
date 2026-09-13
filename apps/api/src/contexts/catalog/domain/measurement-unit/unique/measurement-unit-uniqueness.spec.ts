import { describe, expect, it } from 'vitest';
import { InMemoryMeasurementUnitRepository } from '../../../infrastructure/testing/in-memory-measurement-unit.repository.js';
import {
  DuplicateMeasurementUnitAbbreviationError,
  DuplicateMeasurementUnitNameError,
} from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, UNIT_BOX, UNIT_PIECE, aUnit } from '../../testing/catalog.mother.js';
import { MeasurementUnitId } from '../measurement-unit-id.vo.js';
import { MeasurementUnitName } from '../measurement-unit-name.vo.js';
import { UnitAbbreviation } from '../unit-abbreviation.vo.js';
import { MeasurementUnitUniqueness } from './measurement-unit-uniqueness.js';

const uniqueness = new MeasurementUnitUniqueness(new InMemoryMeasurementUnitRepository([aUnit()]));
const tenantA = TenantId.of(TENANT_A);

describe('MeasurementUnitUniqueness', () => {
  it('rejects a name already used', async () => {
    await expect(
      uniqueness.ensureIsFree(tenantA, MeasurementUnitName.of('Unidad'), UnitAbbreviation.of('ud')),
    ).rejects.toThrow(DuplicateMeasurementUnitNameError);
  });

  // Dos unidades con la misma abreviatura imprimirian "12 un" sin saber cual es.
  it('rejects an abbreviation already used', async () => {
    await expect(
      uniqueness.ensureIsFree(tenantA, MeasurementUnitName.of('Pieza'), UnitAbbreviation.of('un')),
    ).rejects.toThrow(DuplicateMeasurementUnitAbbreviationError);
  });

  it('accepts both in another tenant', async () => {
    await expect(
      uniqueness.ensureIsFree(TenantId.of(TENANT_B), MeasurementUnitName.of('Unidad'), UnitAbbreviation.of('un')),
    ).resolves.toBeUndefined();
  });

  it('lets a unit keep its own name and abbreviation while being edited', async () => {
    await expect(
      uniqueness.ensureIsFree(
        tenantA,
        MeasurementUnitName.of('Unidad'),
        UnitAbbreviation.of('un'),
        MeasurementUnitId.of(UNIT_PIECE),
      ),
    ).resolves.toBeUndefined();
  });

  it('does not let another unit take them', async () => {
    await expect(
      uniqueness.ensureIsFree(tenantA, MeasurementUnitName.of('Unidad'), UnitAbbreviation.of('un'), MeasurementUnitId.of(UNIT_BOX)),
    ).rejects.toThrow(DuplicateMeasurementUnitNameError);
  });
});
