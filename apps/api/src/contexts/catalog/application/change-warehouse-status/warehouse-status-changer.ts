import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseFinder } from '../../domain/warehouse/find/warehouse-finder.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';

export interface WarehouseStatusChangerRequest {
  tenantId: string;
  warehouseId: string;
  active: boolean;
}

// Que la bodega por defecto no se desactive lo decide la propia entidad. Que no tenga
// existencias llegara con el inventario (H3).
export class WarehouseStatusChanger {
  constructor(
    private readonly finder: WarehouseFinder,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: WarehouseStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouse = await this.finder.find(tenantId, WarehouseId.of(request.warehouseId));

    if (request.active) {
      warehouse.activate(this.clock.now());
    } else {
      warehouse.deactivate(this.clock.now());
    }

    await this.warehouses.save(warehouse);
  }
}
