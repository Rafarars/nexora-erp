import { describe, expect, it } from 'vitest';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { anInvoice } from '../testing/receivables.mother.js';

const day = (value: string) => ReceivablesDate.of(value);

describe('ReceivableInvoice', () => {
  it('owes its total minus what was collected, and nothing once cancelled', () => {
    expect(anInvoice().balance()).toBe(100);
    expect(anInvoice({ total: 0.3, paid: 0.1 }).balance()).toBe(0.2);
    expect(anInvoice({ paid: 30 }).balance()).toBe(70);
    expect(anInvoice({ status: 'cancelled' }).balance()).toBe(0);
  });

  it('says whether it is pending, partially paid, paid or cancelled', () => {
    expect(anInvoice().collectionStatus()).toBe('pending');
    expect(anInvoice({ paid: 0.01 }).collectionStatus()).toBe('partially_paid');
    expect(anInvoice({ paid: 100 }).collectionStatus()).toBe('paid');
    expect(anInvoice({ status: 'cancelled' }).collectionStatus()).toBe('cancelled');
  });

  it('is overdue from the day after it falls due, and only while it owes something', () => {
    expect(anInvoice().daysOverdue(day('2026-01-20'))).toBe(0);
    expect(anInvoice().daysOverdue(day('2026-01-21'))).toBe(1);
    expect(anInvoice().isOverdue(day('2026-03-01'))).toBe(true);
    expect(anInvoice({ paid: 100 }).isOverdue(day('2026-03-01'))).toBe(false);
  });
});
