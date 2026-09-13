import { AdjustmentNotFoundError } from '../../errors/inventory.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { Adjustment, AdjustmentId } from '../adjustment.entity.js';
import { AdjustmentRepository } from '../adjustment.repository.js';

export class AdjustmentFinder {
  constructor(private readonly adjustments: AdjustmentRepository) {}

  async find(tenantId: TenantId, id: AdjustmentId): Promise<Adjustment> {
    const adjustment = await this.adjustments.find(tenantId, id);

    if (!adjustment) {
      throw new AdjustmentNotFoundError(id.value);
    }

    return adjustment;
  }
}
