import { describe, expect, it } from 'vitest';
import { WarehouseNotFoundError } from '../../domain/errors/not-found.errors.js';
import { InactiveDefaultWarehouseError } from '../../domain/errors/warehouse.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, WAREHOUSE_A, WAREHOUSE_B, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { DefaultWarehouseSetter } from './default-warehouse-setter.js';

const setterFor = (s: CatalogScenario) => new DefaultWarehouseSetter(s.warehouseFinder, s.defaultWarehouse, s.clock);
const defaultOf = async (s: CatalogScenario, tenant = TENANT_A) =>
  (await s.warehouses.findDefault(TenantId.of(tenant)))?.id.value;

describe('DefaultWarehouseSetter', () => {
  it('moves the default mark to the chosen warehouse', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' })],
    });

    await setterFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B });

    expect(await defaultOf(scenario)).toBe(WAREHOUSE_B);
    const defaults = (await scenario.warehouses.searchByTenant(TenantId.of(TENANT_A))).filter((w) => w.isDefault());
    expect(defaults).toHaveLength(1);
  });

  it('refuses an inactive warehouse', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte', active: false })],
    });

    await expect(setterFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B })).rejects.toThrow(
      InactiveDefaultWarehouseError,
    );
  });

  // Ni mover la marca de Globex ni quitarsela a Acme.
  it('cannot choose a warehouse of another tenant', async () => {
    const scenario = aCatalogScenario({
      warehouses: [
        aWarehouse({ isDefault: true }),
        aWarehouse({ id: WAREHOUSE_B, tenantId: TENANT_B, name: 'Ajena' }),
      ],
    });

    await expect(setterFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B })).rejects.toThrow(
      WarehouseNotFoundError,
    );
    expect(await defaultOf(scenario)).toBe(WAREHOUSE_A);
    expect(await defaultOf(scenario, TENANT_B)).toBeUndefined();
  });
});
