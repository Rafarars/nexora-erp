import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { DefaultWarehouse } from '../../domain/warehouse/default/default-warehouse.js';
import { WarehouseFinder } from '../../domain/warehouse/find/warehouse-finder.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';

export class DefaultWarehouseSetter {
  constructor(
    private readonly finder: WarehouseFinder,
    private readonly defaults: DefaultWarehouse,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; warehouseId: string }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouse = await this.finder.find(tenantId, WarehouseId.of(request.warehouseId));

    await this.defaults.assign(tenantId, warehouse, this.clock.now());
  }
}
