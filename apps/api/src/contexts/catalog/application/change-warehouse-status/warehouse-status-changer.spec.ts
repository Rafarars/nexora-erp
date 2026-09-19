import { describe, expect, it } from 'vitest';
import { DefaultWarehouseDeactivationError } from '../../domain/errors/warehouse.errors.js';
import { WarehouseWithOpenDocumentsError, WarehouseWithStockError } from '../../domain/errors/in-use.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { TENANT_A, WAREHOUSE_A, WAREHOUSE_B, aWarehouse } from '../../domain/testing/catalog.mother.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { CatalogScenario, aCatalogScenario } from '../testing/catalog-scenario.js';
import { WarehouseStatusChanger } from './warehouse-status-changer.js';

const changerFor = (s: CatalogScenario) => new WarehouseStatusChanger(s.warehouseFinder, s.stock, s.warehouses, s.clock);

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

  it('explains the default warehouse as such even when it also has stock', async () => {
    const scenario = aCatalogScenario({ warehouses: [aWarehouse({ isDefault: true })] });
    scenario.stock.addStock(TENANT_A, WAREHOUSE_A);

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_A, active: false }),
    ).rejects.toThrow(DefaultWarehouseDeactivationError);
  });

  it('refuses to deactivate a warehouse that still has stock', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' })],
    });
    scenario.stock.addStock(TENANT_A, WAREHOUSE_B);

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B, active: false }),
    ).rejects.toThrow(WarehouseWithStockError);
  });

  // Una bodega vacia puede estar esperando mercancia: cerrarla deja la orden sin donde entrar y
  // el pedido sin de donde salir, igual que pasaba con el articulo antes de protegerlo.
  it('refuses to deactivate a warehouse that open documents still need', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' })],
    });
    scenario.stock.addOpenDocument(TENANT_A, WAREHOUSE_B);

    await expect(
      changerFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B, active: false }),
    ).rejects.toThrow(WarehouseWithOpenDocumentsError);
    expect((await scenario.warehouses.find(TenantId.of(TENANT_A), WarehouseId.of(WAREHOUSE_B)))?.isActive()).toBe(true);
  });

  // Reactivarla nunca estorba a nadie, tenga lo que tenga pendiente.
  it('reactivates a warehouse with open documents', async () => {
    const scenario = aCatalogScenario({
      warehouses: [aWarehouse({ isDefault: true }), aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte', active: false })],
    });
    scenario.stock.addOpenDocument(TENANT_A, WAREHOUSE_B);

    await changerFor(scenario).run({ tenantId: TENANT_A, warehouseId: WAREHOUSE_B, active: true });

    expect((await scenario.warehouses.find(TenantId.of(TENANT_A), WarehouseId.of(WAREHOUSE_B)))?.isActive()).toBe(true);
  });
});
