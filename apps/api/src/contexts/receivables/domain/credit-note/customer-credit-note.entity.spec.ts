import { describe, expect, it } from 'vitest';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteNotConfirmableError,
  CreditNoteNotEditableError,
  CreditNoteReasonDetailRequiredError,
  CreditQuotaExceededError,
  EmptyCreditNoteError,
  FutureReceivablesDateError,
  InvalidCreditNoteLineAmountError,
} from '../errors/receivables.errors.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { CreditNoteId, CustomerCreditNote } from './customer-credit-note.entity.js';
import { CreditQuota } from './credit-quota.service.js';
import { NoteCredit } from './note-credit.service.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '00000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'c1111111-1111-4111-8111-111111111111';
const TODAY = '2026-01-15';
const NOW = new Date('2026-01-15T10:00:00.000Z');

const defaultCurrency = DocumentCurrency.fromPrimitives({
  currency: 'USD',
  exchangeRate: 36.5,
  baseCurrency: 'VES',
  baseExchangeRate: 36.5,
  manualExchangeRate: false,
});

describe('CustomerCreditNote entity', () => {
  it('creates a draft credit note calculating totals and taxes correctly', () => {
    const note = CustomerCreditNote.draft(
      CreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCC-0001',
      {
        customerId: CUSTOMER_ID,
        issueDate: ReceivablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            concept: 'Commercial discount',
            quantity: 2,
            unitPrice: 50,
            taxRate: 0.16,
          },
        ],
      },
      NOW,
      TODAY,
    );

    const p = note.toPrimitives();
    expect(p.status).toBe('draft');
    expect(p.subtotal).toBe(100);
    expect(p.tax).toBe(16);
    expect(p.total).toBe(116);
    expect(p.totalVes).toBe(4234); // 116 * 36.5 = 4234
  });

  it('requires reasonDetail when reason is other', () => {
    expect(() =>
      CustomerCreditNote.draft(
        CreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCC-0001',
        {
          customerId: CUSTOMER_ID,
          issueDate: ReceivablesDate.of('2026-01-10'),
          reason: 'other',
          reasonDetail: '   ',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              quantity: 1,
              unitPrice: 10,
              taxRate: 0,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(CreditNoteReasonDetailRequiredError);
  });

  it('rejects future issue date', () => {
    expect(() =>
      CustomerCreditNote.draft(
        CreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCC-0001',
        {
          customerId: CUSTOMER_ID,
          issueDate: ReceivablesDate.of('2026-01-20'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              quantity: 1,
              unitPrice: 10,
              taxRate: 0,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(FutureReceivablesDateError);
  });

  it('rejects credit note without lines or with non-positive amounts', () => {
    expect(() =>
      CustomerCreditNote.draft(
        CreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCC-0001',
        {
          customerId: CUSTOMER_ID,
          issueDate: ReceivablesDate.of('2026-01-10'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(EmptyCreditNoteError);

    expect(() =>
      CustomerCreditNote.draft(
        CreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCC-0001',
        {
          customerId: CUSTOMER_ID,
          issueDate: ReceivablesDate.of('2026-01-10'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [{ id: '00000000-0000-4000-8000-000000000011', quantity: 0, unitPrice: 10, taxRate: 0 }],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(InvalidCreditNoteLineAmountError);
  });

  it('allows editing only in draft status', () => {
    const note = CustomerCreditNote.draft(
      CreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCC-0001',
      {
        customerId: CUSTOMER_ID,
        issueDate: ReceivablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [{ id: '00000000-0000-4000-8000-000000000011', quantity: 1, unitPrice: 10, taxRate: 0 }],
      },
      NOW,
      TODAY,
    );

    note.update(
      {
        customerId: CUSTOMER_ID,
        issueDate: ReceivablesDate.of('2026-01-11'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [{ id: '00000000-0000-4000-8000-000000000011', quantity: 2, unitPrice: 15, taxRate: 0 }],
      },
      NOW,
      TODAY,
    );

    expect(note.total()).toBe(30);

    note.confirm(NOW, 'p1111111-1111-4111-8111-111111111111');
    expect(note.currentStatus()).toBe('confirmed');

    expect(() =>
      note.update(
        {
          customerId: CUSTOMER_ID,
          issueDate: ReceivablesDate.of('2026-01-11'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [{ id: '00000000-0000-4000-8000-000000000011', quantity: 1, unitPrice: 10, taxRate: 0 }],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(CreditNoteNotEditableError);
  });

  it('cancels credit note and prevents double cancellation', () => {
    const note = CustomerCreditNote.draft(
      CreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCC-0001',
      {
        customerId: CUSTOMER_ID,
        issueDate: ReceivablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [{ id: '00000000-0000-4000-8000-000000000011', quantity: 1, unitPrice: 10, taxRate: 0 }],
      },
      NOW,
      TODAY,
    );

    note.cancel(NOW);
    expect(note.currentStatus()).toBe('cancelled');

    expect(() => note.cancel(NOW)).toThrow(CreditNoteAlreadyCancelledError);
    expect(() => note.confirm(NOW)).toThrow(CreditNoteNotConfirmableError);
  });
});

describe('NoteCredit and CreditQuota domain services', () => {
  it('NoteCredit calculates available balance cleanly', () => {
    expect(NoteCredit.available(100, 40)).toBe(60);
    expect(NoteCredit.available(100, 100)).toBe(0);
    expect(NoteCredit.available(100, 120)).toBe(0);
  });

  it('CreditQuota enforces quota and rejects exceeding requested credit', () => {
    expect(CreditQuota.available(100, 40)).toBe(60);
    expect(() => CreditQuota.ensureWithinQuota(100, 40, 60, 'inv-1')).not.toThrow();
    expect(() => CreditQuota.ensureWithinQuota(100, 40, 60.01, 'inv-1')).toThrow(CreditQuotaExceededError);
  });
});
