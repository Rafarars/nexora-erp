import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseFinder } from '../../domain/warehouse/find/warehouse-finder.js';
import { WarehouseUniqueness } from '../../domain/warehouse/unique/warehouse-uniqueness.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseName } from '../../domain/warehouse/warehouse-name.vo.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';

export interface WarehouseUpdaterRequest {
  tenantId: string;
  warehouseId: string;
  name: string;
  address?: string | null;
}

export class WarehouseUpdater {
  constructor(
    private readonly finder: WarehouseFinder,
    private readonly uniqueness: WarehouseUniqueness,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: WarehouseUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouse = await this.finder.find(tenantId, WarehouseId.of(request.warehouseId));
    const name = WarehouseName.of(request.name);

    await this.uniqueness.ensureNameIsFree(tenantId, name, warehouse.id);

    warehouse.update(name, request.address ?? null, this.clock.now());

    await this.warehouses.save(warehouse);
  }
}
