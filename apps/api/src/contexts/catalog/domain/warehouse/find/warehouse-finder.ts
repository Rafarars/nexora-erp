import { WarehouseNotFoundError } from '../../errors/not-found.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { WarehouseId } from '../warehouse-id.vo.js';
import { Warehouse } from '../warehouse.entity.js';
import { WarehouseRepository } from '../warehouse.repository.js';

export class WarehouseFinder {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async find(tenantId: TenantId, id: WarehouseId): Promise<Warehouse> {
    const warehouse = await this.warehouses.find(tenantId, id);

    if (!warehouse) {
      throw new WarehouseNotFoundError(id.value);
    }

    return warehouse;
  }
}
