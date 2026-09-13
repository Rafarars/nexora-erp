import { describe, expect, it } from 'vitest';
import { WarehouseNotFoundError } from '../../domain/errors/not-found.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, WAREHOUSE_A, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { WarehouseUpdater } from './warehouse-updater.js';

const updaterFor = (s: CatalogScenario) => new WarehouseUpdater(s.warehouseFinder, s.warehouseUniqueness, s.warehouses, s.clock);

describe('WarehouseUpdater', () => {
  it('updates name and address and keeps the default mark', async () => {
    const scenario = aCatalogScenario({ warehouses: [aWarehouse({ isDefault: true })] });

    await updaterFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_A, name: 'Central', address: '' });

    const warehouse = await scenario.warehouses.find(TenantId.of(TENANT_A), WarehouseId.of(WAREHOUSE_A));
    expect(warehouse?.toPrimitives()).toMatchObject({ name: 'Central', address: null, isDefault: true });
  });

  it('cannot reach a warehouse of another tenant', async () => {
    const scenario = aCatalogScenario({ warehouses: [aWarehouse({ tenantId: TENANT_B })] });

    await expect(
      updaterFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_A, name: 'Colado' }),
    ).rejects.toThrow(WarehouseNotFoundError);
  });
});
