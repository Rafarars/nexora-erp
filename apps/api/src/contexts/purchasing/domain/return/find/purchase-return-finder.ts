import { PurchaseReturnNotFoundError } from '../../errors/purchasing.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { PurchaseReturn, PurchaseReturnId } from '../purchase-return.entity.js';
import { PurchaseReturnRepository } from '../purchase-return.repository.js';

export class PurchaseReturnFinder {
  constructor(private readonly returns: PurchaseReturnRepository) {}

  async find(tenantId: TenantId, id: PurchaseReturnId): Promise<PurchaseReturn> {
    const returnEntity = await this.returns.find(tenantId, id);
    if (!returnEntity) throw new PurchaseReturnNotFoundError(id.value);
    return returnEntity;
  }
}
