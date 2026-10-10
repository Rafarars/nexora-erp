import { beforeEach, describe, expect, it } from 'vitest';
import { JournalEntryLine } from '../domain/journal/journal-entry-line.entity.js';
import { JournalEntry } from '../domain/journal/journal-entry.entity.js';
import { JournalEntryRepository } from '../domain/journal/journal-entry.repository.js';
import { TenantId } from '../domain/shared/tenant-id.vo.js';

export interface JournalEntryRepositoryHarness {
  repository: JournalEntryRepository;
  reset(): Promise<void>;
  createAccount(tenantId: string, id: string, code: string): Promise<void>;
}

export function describeJournalEntryRepositoryContract(
  name: string,
  createHarness: () => Promise<JournalEntryRepositoryHarness>,
): void {
  describe(`JournalEntryRepository contract: ${name}`, () => {
    let harness: JournalEntryRepositoryHarness;
    const tenantA = TenantId.of('11111111-1111-4111-8111-111111111111');
    const tenantB = TenantId.of('22222222-2222-4222-8222-222222222222');

    const accountA1 = '33333333-3333-4333-8333-333333333331';
    const accountA2 = '33333333-3333-4333-8333-333333333332';
    const accountB1 = '44444444-4444-4444-8444-444444444441';
    const accountB2 = '44444444-4444-4444-8444-444444444442';

    beforeEach(async () => {
      harness = await createHarness();
      await harness.reset();
      await harness.createAccount(tenantA.value, accountA1, '1.1.01');
      await harness.createAccount(tenantA.value, accountA2, '4.1.01');
      await harness.createAccount(tenantB.value, accountB1, '1.1.01');
      await harness.createAccount(tenantB.value, accountB2, '4.1.01');
    });

    it('saves and finds a journal entry by id and by code', async () => {
      const entryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const entry = JournalEntry.create({
        id: entryId,
        tenantId: tenantA,
        code: 'AST-000001',
        entryDate: new Date('2026-10-10'),
        originType: 'invoice',
        originId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        description: 'Venta de productos',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: '00000000-0000-4000-8000-000000000001', accountId: accountA1, amount: 100, label: 'Caja' }),
          JournalEntryLine.credit({ id: '00000000-0000-4000-8000-000000000002', accountId: accountA2, amount: 100, label: 'Ingresos' }),
        ],
      });

      await harness.repository.save(entry);

      const foundById = await harness.repository.findById(tenantA, entryId);
      expect(foundById).not.toBeNull();
      expect(foundById!.id).toBe(entryId);
      expect(foundById!.code).toBe('AST-000001');
      expect(foundById!.lines).toHaveLength(2);
      expect(foundById!.totalDebit()).toBe(100);
      expect(foundById!.totalCredit()).toBe(100);

      const foundByCode = await harness.repository.findByCode(tenantA, 'AST-000001');
      expect(foundByCode).not.toBeNull();
      expect(foundByCode!.id).toBe(entryId);
    });

    it('finds journal entry by origin and by reversalOfId', async () => {
      const origId = 'aaaaaaaa-aaaa-4aaa-8aaa-111111111111';
      const docId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const original = JournalEntry.create({
        id: origId,
        tenantId: tenantA,
        code: 'AST-000010',
        entryDate: new Date('2026-10-10'),
        originType: 'sales_invoice',
        originId: docId,
        description: 'Factura 10',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: '00000000-0000-4000-8000-000000000011', accountId: accountA1, amount: 50, label: 'Caja' }),
          JournalEntryLine.credit({ id: '00000000-0000-4000-8000-000000000012', accountId: accountA2, amount: 50, label: 'Ventas' }),
        ],
      });
      await harness.repository.save(original);

      const byOrigin = await harness.repository.findByOrigin(tenantA, 'sales_invoice', docId);
      expect(byOrigin).not.toBeNull();
      expect(byOrigin!.id).toBe(origId);

      const reversal = original.reverse({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-222222222222',
        code: 'AST-000011',
        date: new Date('2026-10-11'),
        description: 'Anulación de factura 10',
        lineIds: (idx) => `00000000-0000-4000-8000-00000000002${idx + 1}`,
      });
      await harness.repository.save(reversal);

      const byReversal = await harness.repository.findByReversalOf(tenantA, origId);
      expect(byReversal).not.toBeNull();
      expect(byReversal!.id).toBe(reversal.id);
      expect(byReversal!.reversalOfId).toBe(origId);
    });

    it('searches entries with filters and respects pagination', async () => {
      const entry1 = JournalEntry.create({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
        tenantId: tenantA,
        code: 'AST-000001',
        entryDate: new Date('2026-10-01'),
        originType: 'invoice',
        originId: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
        description: 'Venta inicial',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: '00000000-0000-4000-8000-000000000031', accountId: accountA1, amount: 10, label: 'Caja' }),
          JournalEntryLine.credit({ id: '00000000-0000-4000-8000-000000000032', accountId: accountA2, amount: 10, label: 'Ingresos' }),
        ],
      });

      const entry2 = JournalEntry.create({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
        tenantId: tenantA,
        code: 'AST-000002',
        entryDate: new Date('2026-10-15'),
        originType: 'dispatch',
        originId: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
        description: 'Despacho de mercancía',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: '00000000-0000-4000-8000-000000000041', accountId: accountA2, amount: 20, label: 'Costo' }),
          JournalEntryLine.credit({ id: '00000000-0000-4000-8000-000000000042', accountId: accountA1, amount: 20, label: 'Inventario' }),
        ],
      });

      await harness.repository.save(entry1);
      await harness.repository.save(entry2);

      const all = await harness.repository.search(tenantA);
      expect(all.total).toBe(2);
      expect(all.entries).toHaveLength(2);

      const filteredByOrigin = await harness.repository.search(tenantA, { originType: 'dispatch' });
      expect(filteredByOrigin.total).toBe(1);
      expect(filteredByOrigin.entries[0].id).toBe(entry2.id);

      const filteredByDate = await harness.repository.search(tenantA, {
        from: new Date('2026-10-10'),
        to: new Date('2026-10-20'),
      });
      expect(filteredByDate.total).toBe(1);
      expect(filteredByDate.entries[0].id).toBe(entry2.id);

      const paginated = await harness.repository.search(tenantA, { limit: 1, offset: 0 });
      expect(paginated.total).toBe(2);
      expect(paginated.entries).toHaveLength(1);
    });

    it('isolates journal entries between tenants', async () => {
      const entryA = JournalEntry.create({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: tenantA,
        code: 'AST-000001',
        entryDate: new Date('2026-10-10'),
        originType: 'invoice',
        originId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        description: 'Asiento de Tenant A',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: '00000000-0000-4000-8000-000000000051', accountId: accountA1, amount: 30, label: 'Caja A' }),
          JournalEntryLine.credit({ id: '00000000-0000-4000-8000-000000000052', accountId: accountA2, amount: 30, label: 'Ingresos A' }),
        ],
      });

      await harness.repository.save(entryA);

      expect(await harness.repository.findById(tenantB, entryA.id)).toBeNull();
      expect(await harness.repository.findByCode(tenantB, 'AST-000001')).toBeNull();

      const searchB = await harness.repository.search(tenantB);
      expect(searchB.total).toBe(0);
      expect(searchB.entries).toHaveLength(0);
    });
  });
}
