import { TenantId } from '../shared/tenant-id.vo.js';

export const ACCOUNTING_CODE_SEQUENCE = Symbol('AccountingCodeSequence');

export interface AccountingCodeSequence {
  next(tenantId: TenantId): Promise<number>;
}

export function formatJournalEntryCode(seq: number): string {
  return `AST-${String(seq).padStart(6, '0')}`;
}
