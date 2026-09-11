import { TenantNotFoundError } from '../../errors/tenant-not-found.error.js';
import { TenantId } from '../tenant-id.vo.js';
import { Tenant } from '../tenant.entity.js';
import { TenantRepository } from '../tenant.repository.js';

// El repositorio devuelve null; quien decide que eso es un error es este servicio.
// Asi el `if (!tenant) throw` deja de copiarse en cada caso de uso.
export class TenantFinder {
  constructor(private readonly tenants: TenantRepository) {}

  async find(id: TenantId): Promise<Tenant> {
    const tenant = await this.tenants.find(id);

    if (!tenant) {
      throw new TenantNotFoundError(id.value);
    }

    return tenant;
  }
}
