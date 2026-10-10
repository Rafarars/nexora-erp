import { AccountingCodeSequence } from '../../domain/journal/accounting-code-sequence.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryAccountingCodeSequence implements AccountingCodeSequence {
  private readonly sequences = new Map<string, number>();

  async next(tenantId: TenantId): Promise<number> {
    const current = this.sequences.get(tenantId.value) ?? 0;
    const nextVal = current + 1;
    this.sequences.set(tenantId.value, nextVal);
    return nextVal;
  }
}
