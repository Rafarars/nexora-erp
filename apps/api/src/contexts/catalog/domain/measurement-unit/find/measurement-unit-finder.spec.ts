import { describe, expect, it } from 'vitest';
import { InMemoryMeasurementUnitRepository } from '../../../infrastructure/testing/in-memory-measurement-unit.repository.js';
import { MeasurementUnitNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, UNIT_BOX, UNIT_KILO, UNIT_PIECE, aUnit } from '../../testing/catalog.mother.js';
import { MeasurementUnitId } from '../measurement-unit-id.vo.js';
import { MeasurementUnitFinder } from './measurement-unit-finder.js';

const finder = new MeasurementUnitFinder(
  new InMemoryMeasurementUnitRepository([
    aUnit(),
    aUnit({ id: UNIT_BOX, name: 'Caja', abbreviation: 'cja', code: 'UOM000002' }),
    aUnit({ id: UNIT_KILO, tenantId: TENANT_B, name: 'Kilogramo', abbreviation: 'kg' }),
  ]),
);
const tenantA = TenantId.of(TENANT_A);

describe('MeasurementUnitFinder', () => {
  it('returns every requested unit', async () => {
    const units = await finder.findAll(tenantA, [MeasurementUnitId.of(UNIT_PIECE), MeasurementUnitId.of(UNIT_BOX)]);

    expect(units).toHaveLength(2);
  });

  // Todo o nada: un articulo no se guarda con la mitad de sus unidades.
  it('throws when one of them belongs to another tenant', async () => {
    await expect(
      finder.findAll(tenantA, [MeasurementUnitId.of(UNIT_PIECE), MeasurementUnitId.of(UNIT_KILO)]),
    ).rejects.toThrow(MeasurementUnitNotFoundError);
  });

  it('finds one by id', async () => {
    expect((await finder.find(tenantA, MeasurementUnitId.of(UNIT_BOX))).id.value).toBe(UNIT_BOX);
  });

  it('treats a unit of another tenant as missing', async () => {
    await expect(finder.find(tenantA, MeasurementUnitId.of(UNIT_KILO))).rejects.toThrow(MeasurementUnitNotFoundError);
  });
});
