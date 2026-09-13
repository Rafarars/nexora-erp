import { describe, expect, it } from 'vitest';
import { DuplicateWarehouseNameError } from '../../domain/errors/duplicate.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { WarehouseCreator } from './warehouse-creator.js';

const creatorFor = (s: CatalogScenario) =>
  new WarehouseCreator(s.defaultWarehouse, s.warehouseUniqueness, s.codes, s.ids, s.clock);
const listed = async (s: CatalogScenario) =>
  (await s.warehouses.searchByTenant(TenantId.of(TENANT_A))).map((warehouse) => warehouse.toPrimitives());

describe('WarehouseCreator', () => {
  it('makes the first warehouse of the tenant the default one', async () => {
    const scenario = aCatalogScenario();

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Principal', address: 'Av. 1' });

    expect(await listed(scenario)).toMatchObject([
      { code: 'BOD000001', name: 'Principal', address: 'Av. 1', isDefault: true, isActive: true },
    ]);
  });

  it('creates the next ones without taking the mark', async () => {
    // Sembrada con un codigo alto: el contador del escenario empieza en 1.
    const scenario = aCatalogScenario({ warehouses: [aWarehouse({ isDefault: true, code: 'BOD000100' })] });

    await creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Norte' });

    const norte = (await listed(scenario)).find((warehouse) => warehouse.name === 'Norte');
    expect(norte?.isDefault).toBe(false);
  });

  it('rejects a repeated name', async () => {
    const scenario = aCatalogScenario({ warehouses: [aWarehouse()] });

    await expect(creatorFor(scenario).run({ tenantId: TENANT_A, name: 'Principal' })).rejects.toThrow(
      DuplicateWarehouseNameError,
    );
  });
});
