import { SupplierNotFoundError } from '../../errors/purchasing.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Supplier, SupplierId } from '../supplier.entity.js';
import { SupplierRepository } from '../supplier.repository.js';

export class SupplierFinder {
  constructor(private readonly suppliers: SupplierRepository) {}

  async find(tenantId: TenantId, id: SupplierId): Promise<Supplier> {
    const supplier = await this.suppliers.find(tenantId, id);

    if (!supplier) throw new SupplierNotFoundError(id.value);

    return supplier;
  }
}
