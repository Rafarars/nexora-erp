import { JournalEntryRepository } from '../../domain/journal/journal-entry.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface SearchJournalEntriesRequest {
  tenantId: string;
  originType?: string;
  originId?: string;
  from?: string;
  to?: string;
  accountId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface JournalEntryListItem {
  id: string;
  code: string;
  entryDate: string;
  originType: string;
  originId: string;
  description: string;
  currency: string;
  reversalOfId: string | null;
  totalDebit: number;
  totalCredit: number;
  linesCount: number;
}

export interface SearchJournalEntriesResponse {
  items: JournalEntryListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export class SearchJournalEntriesUseCase {
  constructor(private readonly entries: JournalEntryRepository) {}

  async execute(request: SearchJournalEntriesRequest): Promise<SearchJournalEntriesResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const page = Math.max(1, request.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, request.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const fromDate = request.from ? new Date(request.from) : undefined;
    const toDate = request.to ? new Date(request.to) : undefined;

    const { entries, total } = await this.entries.search(tenantId, {
      originType: request.originType,
      originId: request.originId,
      from: fromDate,
      to: toDate,
      accountId: request.accountId,
      query: request.query,
      offset,
      limit: pageSize,
    });

    const items: JournalEntryListItem[] = entries.map((e) => ({
      id: e.id,
      code: e.code,
      entryDate: e.entryDate.toISOString().slice(0, 10),
      originType: e.originType,
      originId: e.originId,
      description: e.description,
      currency: e.currency,
      reversalOfId: e.reversalOfId,
      totalDebit: e.totalDebit(),
      totalCredit: e.totalCredit(),
      linesCount: e.lines.length,
    }));

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
