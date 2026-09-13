import { DuplicateSupplierNameError } from '../../errors/purchasing.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SupplierId } from '../supplier.entity.js';
import { SupplierRepository } from '../supplier.repository.js';

// La base tiene la ultima palabra (indice unico); esto da el error claro en el caso comun.
export class SupplierUniqueness {
  constructor(private readonly suppliers: SupplierRepository) {}

  async ensureNameIsFree(tenantId: TenantId, name: string, except?: SupplierId): Promise<void> {
    const existing = await this.suppliers.findByName(tenantId, name.trim());

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateSupplierNameError(name.trim(), tenantId.value);
    }
  }
}
