import { Clock } from '../../../../shared/domain/ports/clock.js';
import { SupplierWithOpenOrdersError } from '../../domain/errors/purchasing.errors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';
import { SupplierUsage } from '../../domain/supplier/usage/supplier-usage.js';

// Desactivar impide las ordenes nuevas y la confirmacion de sus borradores. Lo que no se
// permite es cerrarlo con mercancia en camino: esas ordenes se quedarian sin quien las cierre.
export class SupplierStatusChanger {
  constructor(
    private readonly finder: SupplierFinder,
    private readonly usage: SupplierUsage,
    private readonly suppliers: SupplierRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; supplierId: string; active: boolean }): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const supplier = await this.finder.find(tenantId, SupplierId.of(request.supplierId));

    if (request.active) {
      supplier.activate(this.clock.now());
    } else {
      supplier.deactivate(this.clock.now());

      if (await this.usage.hasOpenOrders(tenantId, supplier.id)) {
        throw new SupplierWithOpenOrdersError(supplier.id.value);
      }
    }

    await this.suppliers.save(supplier);
  }
}
