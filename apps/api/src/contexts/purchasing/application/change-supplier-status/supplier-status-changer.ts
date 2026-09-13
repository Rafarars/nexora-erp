import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';

// Desactivar no toca las ordenes que ya tiene: impide las nuevas y la confirmacion de sus
// borradores, que se revalidan al confirmar.
export class SupplierStatusChanger {
  constructor(
    private readonly finder: SupplierFinder,
    private readonly suppliers: SupplierRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string; supplierId: string; active: boolean }): Promise<void> {
    const supplier = await this.finder.find(TenantId.of(request.tenantId), SupplierId.of(request.supplierId));

    if (request.active) {
      supplier.activate(this.clock.now());
    } else {
      supplier.deactivate(this.clock.now());
    }

    await this.suppliers.save(supplier);
  }
}
