import { describe, expect, it } from 'vitest';
import { DefaultWarehouseDeactivationError } from '../../domain/errors/warehouse.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, WAREHOUSE_A, WAREHOUSE_B, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { WarehouseStatusChanger } from './warehouse-status-changer.js';

const changerFor = (s: CatalogScenario) => new WarehouseStatusChanger(s.warehouseFinder, s.warehouses, s.clock);

describe('WarehouseStatusChanger', () => {
  it('refuses to deactivate the default warehouse and leaves it active', async () => {
    const scenario = aCatalogScenario({ warehouses: [aWarehouse({ isDefault: true })] });

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_A, active: false }),
    ).rejects.toThrow(DefaultWarehouseDeactivationError);
    expect((await scenario.warehouses.find(TenantId.of(TENANT_A), WarehouseId.of(WAREHOUSE_A)))?.isActive()).toBe(true);
  });

  it('deactivates and reactivates a warehouse that is not the default one', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' })],
    });
    const changer = changerFor(scenario);
    const isActive = async () =>
      (await scenario.warehouses.find(TenantId.of(TENANT_A), WarehouseId.of(WAREHOUSE_B)))?.isActive();

    await changer.run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B, active: false });
    expect(await isActive()).toBe(false);

    await changer.run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B, active: true });
    expect(await isActive()).toBe(true);
  });
});
