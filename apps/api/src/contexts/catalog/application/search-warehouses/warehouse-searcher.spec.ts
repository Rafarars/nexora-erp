import { describe, expect, it } from 'vitest';
import { TENANT_A, WAREHOUSE_B, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { aCatalogScenario } from '../testing/catalog-scenario.js';
import { WarehouseSearcher } from './warehouse-searcher.js';

describe('WarehouseSearcher', () => {
  it('tells which warehouse is the default one', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, name: 'Norte', code: 'BOD000002' })],
    });

    const { warehouses } = await new WarehouseSearcher(scenario.warehouses).run({ tenantId: TENANT_A });

    expect(warehouses.map((warehouse) => [warehouse.name, warehouse.isDefault])).toEqual([
      ['Norte', false],
      ['Principal', true],
    ]);
  });
});
