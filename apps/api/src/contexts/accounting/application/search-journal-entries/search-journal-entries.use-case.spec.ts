import { describe, expect, it } from 'vitest';
import { JournalEntryLine } from '../../domain/journal/journal-entry-line.entity.js';
import { JournalEntry } from '../../domain/journal/journal-entry.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { InMemoryJournalEntryRepository } from '../../infrastructure/testing/in-memory-journal-entry.repository.js';
import { SearchJournalEntriesUseCase } from './search-journal-entries.use-case.js';

describe('SearchJournalEntriesUseCase', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const accountCash = '33333333-3333-4333-8333-333333333331';
  const accountSales = '33333333-3333-4333-8333-333333333332';

  it('returns paginated items and calculates totals', async () => {
    const repository = new InMemoryJournalEntryRepository();
    const useCase = new SearchJournalEntriesUseCase(repository);

    const entry = JournalEntry.create({
      id: 'entry-01',
      tenantId: TenantId.of(tenantId),
      code: 'AST-000001',
      entryDate: new Date('2026-10-10'),
      originType: 'invoice',
      originId: 'inv-01',
      description: 'Venta al contado',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 150, label: 'Caja' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountSales, amount: 150, label: 'Ventas' }),
      ],
    });
    await repository.save(entry);

    const response = await useCase.execute({ tenantId });

    expect(response.total).toBe(1);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toEqual({
      id: 'entry-01',
      code: 'AST-000001',
      entryDate: '2026-10-10',
      originType: 'invoice',
      originId: 'inv-01',
      description: 'Venta al contado',
      currency: 'USD',
      reversalOfId: null,
      totalDebit: 150,
      totalCredit: 150,
      linesCount: 2,
    });
  });
});
