import { AccountRepository } from '../../domain/account/account.repository.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { JournalEntryNotFoundError } from '../../domain/errors/accounting.errors.js';
import { JournalEntryRepository } from '../../domain/journal/journal-entry.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface GetJournalEntryRequest {
  tenantId: string;
  id: string;
}

export interface JournalEntryLineDetail {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  label: string;
}

export interface GetJournalEntryResponse {
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
  lines: JournalEntryLineDetail[];
}

export class GetJournalEntryUseCase {
  constructor(
    private readonly entries: JournalEntryRepository,
    private readonly accounts?: AccountRepository,
  ) {}

  async execute(request: GetJournalEntryRequest): Promise<GetJournalEntryResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const entry = await this.entries.findById(tenantId, request.id);

    if (!entry) {
      throw new JournalEntryNotFoundError(request.id);
    }

    const lines: JournalEntryLineDetail[] = [];

    for (const l of entry.lines) {
      let accountCode: string | undefined;
      let accountName: string | undefined;

      if (this.accounts) {
        const account = await this.accounts.findById(tenantId, AccountId.of(l.accountId));
        if (account) {
          accountCode = account.code().raw;
          accountName = account.name();
        }
      }

      lines.push({
        id: l.id,
        accountId: l.accountId,
        accountCode,
        accountName,
        debit: l.debit,
        credit: l.credit,
        label: l.label,
      });
    }

    return {
      id: entry.id,
      code: entry.code,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      originType: entry.originType,
      originId: entry.originId,
      description: entry.description,
      currency: entry.currency,
      reversalOfId: entry.reversalOfId,
      totalDebit: entry.totalDebit(),
      totalCredit: entry.totalCredit(),
      lines,
    };
  }
}
