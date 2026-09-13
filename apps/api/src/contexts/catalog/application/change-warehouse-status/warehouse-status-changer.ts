import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { WarehouseWithStockError } from '../../domain/errors/in-use.errors.js';
import { StockUsage } from '../../domain/stock/stock-usage.js';
import { WarehouseFinder } from '../../domain/warehouse/find/warehouse-finder.js';
import { WarehouseId } from '../../domain/warehouse/warehouse-id.vo.js';
import { WarehouseRepository } from '../../domain/warehouse/warehouse.repository.js';

export interface WarehouseStatusChangerRequest {
  tenantId: string;
  warehouseId: string;
  active: boolean;
}

// Que la bodega por defecto no se desactive lo decide la propia entidad; que no tenga
// existencia lo pregunta al inventario.
export class WarehouseStatusChanger {
  constructor(
    private readonly finder: WarehouseFinder,
    private readonly stock: StockUsage,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: WarehouseStatusChangerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const warehouse = await this.finder.find(tenantId, WarehouseId.of(request.warehouseId));

    if (request.active) {
      warehouse.activate(this.clock.now());
    } else {
      // Primero la regla de la propia bodega, que no necesita consultar nada: la bodega por
      // defecto se explica como tal aunque ademas tenga existencia.
      warehouse.deactivate(this.clock.now());

      if (await this.stock.warehouseHasStock(tenantId, warehouse.id)) {
        throw new WarehouseWithStockError(warehouse.id.value);
      }
    }

    await this.warehouses.save(warehouse);
  }
}
