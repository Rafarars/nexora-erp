import { TenantId } from '../shared/tenant-id.vo.js';
import { JournalEntry } from './journal-entry.entity.js';

export const JOURNAL_ENTRY_REPOSITORY = Symbol('JournalEntryRepository');

export interface JournalEntryFilters {
  originType?: string;
  originId?: string;
  from?: Date;
  to?: Date;
  accountId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface JournalEntryRepository {
  save(entry: JournalEntry): Promise<void>;
  findById(tenantId: TenantId, id: string): Promise<JournalEntry | null>;
  findByCode(tenantId: TenantId, code: string): Promise<JournalEntry | null>;
  findByOrigin(tenantId: TenantId, originType: string, originId: string): Promise<JournalEntry | null>;
  findByReversalOf(tenantId: TenantId, reversalOfId: string): Promise<JournalEntry | null>;
  search(tenantId: TenantId, filters?: JournalEntryFilters): Promise<{ entries: JournalEntry[]; total: number }>;
}
