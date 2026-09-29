import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';
import { PaymentDetails, PaymentRates } from '../payment/supplier-payment.entity.js';
import { PayableInvoice, PayableInvoicePrimitives } from '../ledger/payable-invoice.js';
import { PayablesDate } from '../shared/payables-date.vo.js';

export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const TODAY = '2026-01-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const SUPPLIER = 'e8111111-1111-4111-8111-111111111111';
export const OTHER_SUPPLIER = 'e8222222-2222-4222-8222-222222222222';

export const INVOICE = 'f1111111-1111-4111-8111-111111111111';
export const OTHER_INVOICE = 'f2222222-2222-4222-8222-222222222222';

export const PAYMENT = 'd1111111-1111-4111-8111-111111111111';

export const DOLLARS = { currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false };

export function aPaymentRates(currency: Partial<DocumentRateSet> = {}, invoiceRates: Record<string, number> = {}, decimals = 2): PaymentRates {
  const own = DocumentCurrency.of({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualRate: false, ...currency });

  return { currency: own, invoiceRates: { USD: 36.5, [own.currency]: own.exchangeRate!, ...invoiceRates }, decimals };
}

export function aPayableInvoice(overrides: Partial<PayableInvoicePrimitives> = {}): PayableInvoice {
  return PayableInvoice.of({
    id: INVOICE,
    code: 'FCP-0001',
    supplierId: SUPPLIER,
    issueDate: '2026-01-05',
    dueDate: '2026-01-20',
    status: 'confirmed',
    total: 100,
    ...DOLLARS,
    paid: 0,
    ...overrides,
  });
}

export function paymentDetails(overrides: Partial<PaymentDetails> = {}): PaymentDetails {
  return {
    supplierId: SUPPLIER,
    date: PayablesDate.of(TODAY),
    method: 'transfer',
    reference: 'TRF-001',
    notes: null,
    allocations: [{ id: 'a1000000-0000-4000-8000-000000000001', invoiceId: INVOICE, amount: 40 }],
    ...overrides,
  };
}
