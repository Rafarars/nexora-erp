import { describe, expect, it } from 'vitest';
import { InMemoryWarehouseRepository } from '../../../infrastructure/testing/in-memory-warehouse.repository.js';
import { DuplicateWarehouseNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { TENANT_A, TENANT_B, WAREHOUSE_A, WAREHOUSE_B, aWarehouse } from '../../testing/catalog.mother.js';
import { WarehouseId } from '../warehouse-id.vo.js';
import { WarehouseName } from '../warehouse-name.vo.js';
import { WarehouseUniqueness } from './warehouse-uniqueness.js';

const uniqueness = new WarehouseUniqueness(new InMemoryWarehouseRepository([aWarehouse()]));

describe('WarehouseUniqueness', () => {
  it('rejects a name already used in the tenant', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), WarehouseName.of('Principal'))).rejects.toThrow(
      DuplicateWarehouseNameError,
    );
  });

  it('accepts it in another tenant', async () => {
    await expect(uniqueness.ensureNameIsFree(TenantId.of(TENANT_B), WarehouseName.of('Principal'))).resolves.toBeUndefined();
  });

  it('lets the warehouse keep its own name', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), WarehouseName.of('Principal'), WarehouseId.of(WAREHOUSE_A)),
    ).resolves.toBeUndefined();
  });

  it('does not let another warehouse take it', async () => {
    await expect(
      uniqueness.ensureNameIsFree(TenantId.of(TENANT_A), WarehouseName.of('Principal'), WarehouseId.of(WAREHOUSE_B)),
    ).rejects.toThrow(DuplicateWarehouseNameError);
  });
});
