import { describe, expect, it } from 'vitest';
import { InMemoryWarehouseRepository } from '../../../infrastructure/testing/in-memory-warehouse.repository.js';
import { InactiveDefaultWarehouseError } from '../../errors/warehouse.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { LATER, TENANT_A, TENANT_B, WAREHOUSE_A, WAREHOUSE_B, aWarehouse } from '../../testing/catalog.mother.js';
import { WarehouseId } from '../warehouse-id.vo.js';
import { DefaultWarehouse } from './default-warehouse.js';

const tenantA = TenantId.of(TENANT_A);

async function defaultOf(repository: InMemoryWarehouseRepository, tenant = tenantA) {
  return (await repository.findDefault(tenant))?.id.value ?? null;
}

describe('DefaultWarehouse', () => {
  it('makes the first warehouse of a tenant the default one', async () => {
    const repository = new InMemoryWarehouseRepository();

    await new DefaultWarehouse(repository).register(aWarehouse(), LATER);

    expect(await defaultOf(repository)).toBe(WAREHOUSE_A);
  });

  it('does not steal the mark when there already is a default one', async () => {
    const repository = new InMemoryWarehouseRepository([aWarehouse({ isDefault: true })]);

    await new DefaultWarehouse(repository).register(aWarehouse({ id: WAREHOUSE_B, code: 'BOD000002', name: 'Norte' }), LATER);

    expect(await defaultOf(repository)).toBe(WAREHOUSE_A);
  });

  // La bodega por defecto de otra empresa no cuenta: cada una tiene la suya.
  it('ignores the default warehouse of another tenant', async () => {
    const repository = new InMemoryWarehouseRepository([aWarehouse({ tenantId: TENANT_B, isDefault: true })]);

    await new DefaultWarehouse(repository).register(aWarehouse({ id: WAREHOUSE_B }), LATER);

    expect(await defaultOf(repository)).toBe(WAREHOUSE_B);
  });

  it('moves the mark and leaves exactly one default', async () => {
    const repository = new InMemoryWarehouseRepository([
      aWarehouse({ isDefault: true }),
      aWarehouse({ id: WAREHOUSE_B, name: 'Norte', code: 'BOD000002' }),
    ]);
    const norte = (await repository.find(tenantA, WarehouseId.of(WAREHOUSE_B)))!;

    await new DefaultWarehouse(repository).assign(tenantA, norte, LATER);

    const defaults = (await repository.searchByTenant(tenantA)).filter((warehouse) => warehouse.isDefault());
    expect(defaults.map((warehouse) => warehouse.id.value)).toEqual([WAREHOUSE_B]);
  });

  it('does nothing when the warehouse already is the default one', async () => {
    const repository = new InMemoryWarehouseRepository([aWarehouse({ isDefault: true })]);
    const principal = (await repository.find(tenantA, WarehouseId.of(WAREHOUSE_A)))!;

    await new DefaultWarehouse(repository).assign(tenantA, principal, LATER);

    expect((await repository.find(tenantA, WarehouseId.of(WAREHOUSE_A)))?.toPrimitives().updatedAt).not.toEqual(LATER);
  });

  it('refuses an inactive warehouse and keeps the current default', async () => {
    const repository = new InMemoryWarehouseRepository([
      aWarehouse({ isDefault: true }),
      aWarehouse({ id: WAREHOUSE_B, name: 'Norte', active: false }),
    ]);
    const norte = (await repository.find(tenantA, WarehouseId.of(WAREHOUSE_B)))!;

    await expect(new DefaultWarehouse(repository).assign(tenantA, norte, LATER)).rejects.toThrow(
      InactiveDefaultWarehouseError,
    );
    expect(await defaultOf(repository)).toBe(WAREHOUSE_A);
  });
});
