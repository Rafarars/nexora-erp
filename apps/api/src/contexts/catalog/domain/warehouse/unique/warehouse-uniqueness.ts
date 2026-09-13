import { DuplicateWarehouseNameError } from '../../errors/duplicate.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { WarehouseId } from '../warehouse-id.vo.js';
import { WarehouseName } from '../warehouse-name.vo.js';
import { WarehouseRepository } from '../warehouse.repository.js';

export class WarehouseUniqueness {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async ensureNameIsFree(tenantId: TenantId, name: WarehouseName, except?: WarehouseId): Promise<void> {
    const existing = await this.warehouses.findByName(tenantId, name);

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateWarehouseNameError(name.value, tenantId.value);
    }
  }
}
