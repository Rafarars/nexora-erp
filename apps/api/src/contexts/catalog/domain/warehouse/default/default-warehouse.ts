import { TenantId } from '../../shared/tenant-id.vo.js';
import { Warehouse } from '../warehouse.entity.js';
import { WarehouseRepository } from '../warehouse.repository.js';

// Una empresa tiene exactamente una bodega por defecto en cuanto tiene alguna: la
// primera lo es sola, y elegir otra le quita la marca a la anterior en la misma
// escritura.
export class DefaultWarehouse {
  constructor(private readonly warehouses: WarehouseRepository) {}

  async register(warehouse: Warehouse, now: Date): Promise<void> {
    if (!(await this.warehouses.findDefault(warehouse.tenantId))) {
      warehouse.markAsDefault(now);
    }

    await this.warehouses.save(warehouse);
  }

  async assign(tenantId: TenantId, warehouse: Warehouse, now: Date): Promise<void> {
    const current = await this.warehouses.findDefault(tenantId);

    if (current?.id.equals(warehouse.id)) {
      return;
    }

    warehouse.markAsDefault(now);
    current?.unmarkAsDefault(now);

    await this.warehouses.saveAll(current ? [current, warehouse] : [warehouse]);
  }
}
