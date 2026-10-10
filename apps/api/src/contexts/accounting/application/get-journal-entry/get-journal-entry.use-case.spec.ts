import { describe, expect, it } from 'vitest';
import { AccountCode } from '../../domain/account/account-code.vo.js';
import { AccountId } from '../../domain/account/account-id.vo.js';
import { Account } from '../../domain/account/account.entity.js';
import { JournalEntryNotFoundError } from '../../domain/errors/accounting.errors.js';
import { JournalEntryLine } from '../../domain/journal/journal-entry-line.entity.js';
import { JournalEntry } from '../../domain/journal/journal-entry.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryAccountRepository } from '../../infrastructure/testing/in-memory-account.repository.js';
import { InMemoryJournalEntryRepository } from '../../infrastructure/testing/in-memory-journal-entry.repository.js';
import { GetJournalEntryUseCase } from './get-journal-entry.use-case.js';

describe('GetJournalEntryUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const accountCashId = '33333333-3333-4333-8333-333333333331';
  const accountSalesId = '33333333-3333-4333-8333-333333333332';

  it('returns entry details with enriched account code and name', async () => {
    const entryRepo = new InMemoryJournalEntryRepository();
    const accountRepo = new InMemoryAccountRepository();

    const accountCash = Account.create(AccountId.of(accountCashId), TenantId.of(tenantId), {
      code: AccountCode.of('1.1.01'),
      name: 'Caja principal',
      type: 'asset',
      acceptsEntries: true,
    });
    const accountSales = Account.create(AccountId.of(accountSalesId), TenantId.of(tenantId), {
      code: AccountCode.of('4.1.01'),
      name: 'Ventas de productos',
      type: 'income',
      acceptsEntries: true,
    });
    await accountRepo.save(accountCash);
    await accountRepo.save(accountSales);

    const entry = JournalEntry.create({
      id: 'entry-detail-01',
      tenantId: TenantId.of(tenantId),
      code: 'AST-000001',
      entryDate: new Date('2026-10-10'),
      originType: 'invoice',
      originId: 'inv-01',
      description: 'Venta',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCashId, amount: 200, label: 'Cobro' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountSalesId, amount: 200, label: 'Venta' }),
      ],
    });
    await entryRepo.save(entry);

    const useCase = new GetJournalEntryUseCase(entryRepo, accountRepo);
    const result = await useCase.execute({ tenantId, id: 'entry-detail-01' });

    expect(result.id).toBe('entry-detail-01');
    expect(result.totalDebit).toBe(200);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].accountCode).toBe('1.1.01');
    expect(result.lines[0].accountName).toBe('Caja principal');
    expect(result.lines[1].accountCode).toBe('4.1.01');
    expect(result.lines[1].accountName).toBe('Ventas de productos');
  });

  it('throws JournalEntryNotFoundError when entry does not exist', async () => {
    const entryRepo = new InMemoryJournalEntryRepository();
    const useCase = new GetJournalEntryUseCase(entryRepo);

    await expect(useCase.execute({ tenantId, id: 'non-existent' })).rejects.toThrow(
      JournalEntryNotFoundError,
    );
  });
});
