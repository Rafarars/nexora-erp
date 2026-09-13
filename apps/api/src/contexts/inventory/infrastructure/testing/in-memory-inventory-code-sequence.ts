import { InventoryCodePrefix, InventoryCodeSequence } from '../../domain/shared/code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryInventoryCodeSequence implements InventoryCodeSequence {
  private readonly counters = new Map<string, number>();

  async next(tenantId: TenantId, prefix: InventoryCodePrefix): Promise<number> {
    const key = `${tenantId.value}:${prefix}`;
    const value = (this.counters.get(key) ?? 0) + 1;

    this.counters.set(key, value);

    return value;
  }
}
