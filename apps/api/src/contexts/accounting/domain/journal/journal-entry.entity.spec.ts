import { describe, expect, it } from 'vitest';
import {
  InvalidJournalEntryLineError,
  JournalEntryAlreadyReversedError,
  JournalEntryUnbalancedError,
} from '../errors/accounting.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { JournalEntryLine } from './journal-entry-line.entity.js';
import { JournalEntry } from './journal-entry.entity.js';

describe('JournalEntry Entity', () => {
  const tenantId = TenantId.of('11111111-1111-4111-8111-111111111111');
  const accountCash = '22222222-2222-4222-8222-222222222222';
  const accountRevenue = '33333333-3333-4333-8333-333333333333';
  const accountTax = '44444444-4444-4444-8444-444444444444';

  it('creates a balanced journal entry with multiple lines', () => {
    const entry = JournalEntry.create({
      id: 'entry-01',
      tenantId,
      code: 'AST-000001',
      entryDate: new Date('2026-10-10'),
      originType: 'invoice',
      originId: 'inv-01',
      description: 'Venta de mercancía',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 116, label: 'Cobro' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountRevenue, amount: 100, label: 'Ingreso' }),
        JournalEntryLine.credit({ id: 'l3', accountId: accountTax, amount: 16, label: 'IVA' }),
      ],
    });

    expect(entry.totalDebit()).toBe(116);
    expect(entry.totalCredit()).toBe(116);
    expect(entry.lines).toHaveLength(3);
    expect(entry.reversalOfId).toBeNull();
  });

  it('rejects an unbalanced journal entry', () => {
    expect(() =>
      JournalEntry.create({
        id: 'entry-02',
        tenantId,
        code: 'AST-000002',
        entryDate: new Date('2026-10-10'),
        originType: 'invoice',
        originId: 'inv-02',
        description: 'Asiento descuadrado',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 100, label: 'Debe' }),
          JournalEntryLine.credit({ id: 'l2', accountId: accountRevenue, amount: 99.99, label: 'Haber' }),
        ],
      }),
    ).toThrow(JournalEntryUnbalancedError);
  });

  it('rejects an entry with fewer than two lines', () => {
    expect(() =>
      JournalEntry.create({
        id: 'entry-03',
        tenantId,
        code: 'AST-000003',
        entryDate: new Date('2026-10-10'),
        originType: 'invoice',
        originId: 'inv-03',
        description: 'Una sola línea',
        currency: 'USD',
        lines: [
          JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 100, label: 'Debe' }),
        ],
      }),
    ).toThrow(InvalidJournalEntryLineError);
  });

  it('rejects a line with both debit and credit positive', () => {
    expect(() =>
      JournalEntryLine.create({
        id: 'l1',
        accountId: accountCash,
        debit: 50,
        credit: 50,
        label: 'Inválida',
      }),
    ).toThrow(InvalidJournalEntryLineError);
  });

  it('rejects a line with both debit and credit zero', () => {
    expect(() =>
      JournalEntryLine.create({
        id: 'l1',
        accountId: accountCash,
        debit: 0,
        credit: 0,
        label: 'Cero',
      }),
    ).toThrow(InvalidJournalEntryLineError);
  });

  it('rejects a line with negative amounts', () => {
    expect(() =>
      JournalEntryLine.create({
        id: 'l1',
        accountId: accountCash,
        debit: -10,
        credit: 0,
        label: 'Negativo',
      }),
    ).toThrow(InvalidJournalEntryLineError);
  });

  it('reverses an entry with inverted lines and links reversalOfId', () => {
    const original = JournalEntry.create({
      id: 'entry-orig',
      tenantId,
      code: 'AST-000010',
      entryDate: new Date('2026-10-10'),
      originType: 'invoice',
      originId: 'inv-10',
      description: 'Factura original',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 100, label: 'Cobro' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountRevenue, amount: 100, label: 'Ingreso' }),
      ],
    });

    const reversal = original.reverse({
      id: 'entry-rev',
      code: 'AST-000011',
      date: new Date('2026-10-11'),
      description: 'Anulación de factura',
      lineIds: (idx) => `rev-l${idx + 1}`,
    });

    expect(reversal.id).toBe('entry-rev');
    expect(reversal.code).toBe('AST-000011');
    expect(reversal.originType).toBe('reversal');
    expect(reversal.reversalOfId).toBe('entry-orig');
    expect(reversal.lines).toHaveLength(2);

    // Línea 1 ahora es crédito de 100 a Cash
    expect(reversal.lines[0].accountId).toBe(accountCash);
    expect(reversal.lines[0].debit).toBe(0);
    expect(reversal.lines[0].credit).toBe(100);

    // Línea 2 ahora es débito de 100 a Revenue
    expect(reversal.lines[1].accountId).toBe(accountRevenue);
    expect(reversal.lines[1].debit).toBe(100);
    expect(reversal.lines[1].credit).toBe(0);

    expect(reversal.totalDebit()).toBe(100);
    expect(reversal.totalCredit()).toBe(100);
  });

  it('rejects reversing an already reversed entry', () => {
    const original = JournalEntry.create({
      id: 'entry-orig',
      tenantId,
      code: 'AST-000010',
      entryDate: new Date('2026-10-10'),
      originType: 'invoice',
      originId: 'inv-10',
      description: 'Factura original',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 100, label: 'Cobro' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountRevenue, amount: 100, label: 'Ingreso' }),
      ],
    });

    const reversal = original.reverse({
      id: 'entry-rev',
      code: 'AST-000011',
      date: new Date('2026-10-11'),
      description: 'Anulación de factura',
    });

    // Intentar revertir el reverso
    expect(() =>
      reversal.reverse({
        id: 'entry-rev-2',
        code: 'AST-000012',
        date: new Date('2026-10-12'),
        description: 'Reverso del reverso',
      }),
    ).toThrow(JournalEntryAlreadyReversedError);
  });

  it('survives round-trip serialization to primitives', () => {
    const entry = JournalEntry.create({
      id: 'entry-rt',
      tenantId,
      code: 'AST-000099',
      entryDate: new Date('2026-10-10T12:00:00.000Z'),
      originType: 'payment',
      originId: 'pay-01',
      description: 'Pago recibido',
      currency: 'USD',
      lines: [
        JournalEntryLine.debit({ id: 'l1', accountId: accountCash, amount: 50, label: 'Caja' }),
        JournalEntryLine.credit({ id: 'l2', accountId: accountRevenue, amount: 50, label: 'Clientes' }),
      ],
    });

    const primitives = entry.toPrimitives();
    const restored = JournalEntry.fromPrimitives(primitives);

    expect(restored.toPrimitives()).toEqual(primitives);
  });
});
