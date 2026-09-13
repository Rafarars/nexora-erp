import { Clock } from '../../../../shared/domain/ports/clock.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { SupplierFinder } from '../../domain/supplier/find/supplier-finder.js';
import { SupplierDetails, SupplierId } from '../../domain/supplier/supplier.entity.js';
import { SupplierRepository } from '../../domain/supplier/supplier.repository.js';
import { SupplierUniqueness } from '../../domain/supplier/unique/supplier-uniqueness.js';

export interface SupplierUpdaterRequest extends SupplierDetails {
  tenantId: string;
  supplierId: string;
}

// Las ordenes guardan el identificador del proveedor, no su nombre: renombrarlo cambia como
// se leen todas, tambien las viejas.
export class SupplierUpdater {
  constructor(
    private readonly finder: SupplierFinder,
    private readonly uniqueness: SupplierUniqueness,
    private readonly suppliers: SupplierRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: SupplierUpdaterRequest): Promise<void> {
    const { tenantId: tenant, supplierId, ...details } = request;
    const tenantId = TenantId.of(tenant);
    const supplier = await this.finder.find(tenantId, SupplierId.of(supplierId));

    supplier.update(details, this.clock.now());
    await this.uniqueness.ensureNameIsFree(tenantId, supplier.name(), supplier.id);
    await this.suppliers.save(supplier);
  }
}
