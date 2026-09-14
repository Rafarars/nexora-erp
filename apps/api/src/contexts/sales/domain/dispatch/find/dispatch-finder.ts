import { DispatchNotFoundError } from '../../errors/sales.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Dispatch, DispatchId } from '../dispatch.entity.js';
import { DispatchRepository } from '../dispatch.repository.js';

export class DispatchFinder {
  constructor(private readonly dispatches: DispatchRepository) {}

  async find(tenantId: TenantId, id: DispatchId): Promise<Dispatch> {
    const dispatch = await this.dispatches.find(tenantId, id);

    if (!dispatch) throw new DispatchNotFoundError(id.value);

    return dispatch;
  }
}
