import { describe, expect, it } from 'vitest';
import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import {
  CreditNoteAlreadyCancelledError,
  CreditNoteInvoiceTotalExceededError,
  CreditNoteNotConfirmableError,
  CreditNoteNotEditableError,
  CreditNoteReasonDetailRequiredError,
  EmptyCreditNoteError,
  FuturePayablesDateError,
  InvalidCreditNoteLineAmountError,
} from '../errors/payables.errors.js';
import { PayablesDate } from '../shared/payables-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import {
  SupplierCreditNote,
  SupplierCreditNoteId,
} from './supplier-credit-note.entity.js';
import { PayableCreditQuota } from './credit-quota.service.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '00000000-0000-4000-8000-000000000001';
const SUPPLIER_ID = 'e8000000-0000-4000-8000-000000000001';
const TODAY = '2026-01-15';
const NOW = new Date('2026-01-15T10:00:00.000Z');

const defaultCurrency = DocumentCurrency.fromPrimitives({
  currency: 'USD',
  exchangeRate: 36.5,
  baseCurrency: 'VES',
  baseExchangeRate: 36.5,
  manualExchangeRate: false,
});

describe('SupplierCreditNote entity', () => {
  it('creates a draft credit note calculating totals and taxes correctly', () => {
    const note = SupplierCreditNote.draft(
      SupplierCreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCP-0001',
      {
        supplierId: SUPPLIER_ID,
        issueDate: PayablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            concept: 'Descuento comercial',
            quantity: 2,
            unitPrice: 50,
            taxRate: 16,
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
      SupplierCreditNote.draft(
        SupplierCreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCP-0001',
        {
          supplierId: SUPPLIER_ID,
          issueDate: PayablesDate.of('2026-01-10'),
          reason: 'other',
          reasonDetail: '   ',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              concept: 'Otro concepto',
              quantity: 1,
              unitPrice: 10,
              taxRate: 16,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(CreditNoteReasonDetailRequiredError);
  });

  it('rejects an empty credit note', () => {
    expect(() =>
      SupplierCreditNote.draft(
        SupplierCreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCP-0001',
        {
          supplierId: SUPPLIER_ID,
          issueDate: PayablesDate.of('2026-01-10'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(EmptyCreditNoteError);
  });

  it('rejects negative or zero line amounts', () => {
    expect(() =>
      SupplierCreditNote.draft(
        SupplierCreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCP-0001',
        {
          supplierId: SUPPLIER_ID,
          issueDate: PayablesDate.of('2026-01-10'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              concept: 'Negativo',
              quantity: -1,
              unitPrice: 10,
              taxRate: 16,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(InvalidCreditNoteLineAmountError);
  });

  it('rejects future issue dates', () => {
    expect(() =>
      SupplierCreditNote.draft(
        SupplierCreditNoteId.of(NOTE_ID),
        TenantId.of(TENANT),
        'NCP-0001',
        {
          supplierId: SUPPLIER_ID,
          issueDate: PayablesDate.of('2026-02-01'),
          reason: 'subsequent_discount',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              concept: 'Línea',
              quantity: 1,
              unitPrice: 10,
              taxRate: 16,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(FuturePayablesDateError);
  });

  it('allows editing only in draft status', () => {
    const note = SupplierCreditNote.draft(
      SupplierCreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCP-0001',
      {
        supplierId: SUPPLIER_ID,
        issueDate: PayablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            concept: 'Original',
            quantity: 1,
            unitPrice: 50,
            taxRate: 16,
          },
        ],
      },
      NOW,
      TODAY,
    );

    note.update(
      {
        supplierId: SUPPLIER_ID,
        issueDate: PayablesDate.of('2026-01-11'),
        reason: 'price_correction',
        currency: defaultCurrency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            concept: 'Modificado',
            quantity: 2,
            unitPrice: 40,
            taxRate: 16,
          },
        ],
      },
      NOW,
      TODAY,
    );

    expect(note.total()).toBe(92.8); // 80 + 12.8

    note.confirm(NOW);
    expect(note.currentStatus()).toBe('confirmed');

    expect(() =>
      note.update(
        {
          supplierId: SUPPLIER_ID,
          issueDate: PayablesDate.of('2026-01-11'),
          reason: 'price_correction',
          currency: defaultCurrency,
          lines: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              concept: 'Intento',
              quantity: 1,
              unitPrice: 10,
              taxRate: 16,
            },
          ],
        },
        NOW,
        TODAY,
      ),
    ).toThrow(CreditNoteNotEditableError);
  });

  it('supports cancellation and rejects double cancel', () => {
    const note = SupplierCreditNote.draft(
      SupplierCreditNoteId.of(NOTE_ID),
      TenantId.of(TENANT),
      'NCP-0001',
      {
        supplierId: SUPPLIER_ID,
        issueDate: PayablesDate.of('2026-01-10'),
        reason: 'subsequent_discount',
        currency: defaultCurrency,
        lines: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            concept: 'Item',
            quantity: 1,
            unitPrice: 20,
            taxRate: 16,
          },
        ],
      },
      NOW,
      TODAY,
    );

    note.confirm(NOW);
    note.cancel(NOW);
    expect(note.currentStatus()).toBe('cancelled');

    expect(() => note.cancel(NOW)).toThrow(CreditNoteAlreadyCancelledError);
    expect(() => note.confirm(NOW)).toThrow(CreditNoteNotConfirmableError);
  });

  describe('PayableCreditQuota', () => {
    it('rejects credit notes totaling more than the invoice total', () => {
      expect(() => PayableCreditQuota.ensureWithinQuota(100, 80, 30, 'inv-1')).toThrow(
        CreditNoteInvoiceTotalExceededError,
      );
    });

    it('allows credit notes up to the invoice total', () => {
      expect(() => PayableCreditQuota.ensureWithinQuota(100, 70, 30, 'inv-1')).not.toThrow();
    });
  });
});
