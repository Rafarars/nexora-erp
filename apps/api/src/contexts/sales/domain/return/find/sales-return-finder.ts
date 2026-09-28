import { SalesReturnNotFoundError } from '../../errors/sales.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { SalesReturn, SalesReturnId } from '../sales-return.entity.js';
import { SalesReturnRepository } from '../sales-return.repository.js';

export class SalesReturnFinder {
  constructor(private readonly returns: SalesReturnRepository) {}

  async find(tenantId: TenantId, id: SalesReturnId): Promise<SalesReturn> {
    const returnEntity = await this.returns.find(tenantId, id);
    if (!returnEntity) throw new SalesReturnNotFoundError(id.value);
    return returnEntity;
  }
}
