import { DuplicateCustomerNameError } from '../../errors/sales.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CustomerId } from '../customer.entity.js';
import { CustomerRepository } from '../customer.repository.js';

// La base tiene la ultima palabra (indice unico); esto da el error claro en el caso comun.
export class CustomerUniqueness {
  constructor(private readonly customers: CustomerRepository) {}

  async ensureNameIsFree(tenantId: TenantId, name: string, except?: CustomerId): Promise<void> {
    const existing = await this.customers.findByName(tenantId, name.trim());

    if (existing && !(except && existing.id.equals(except))) {
      throw new DuplicateCustomerNameError(name.trim(), tenantId.value);
    }
  }
}
