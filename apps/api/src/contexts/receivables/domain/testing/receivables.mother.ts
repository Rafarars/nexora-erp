import { DocumentCurrency } from '../../../../shared/domain/document-currency.js';
import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';
import { PaymentRates } from '../payment/customer-payment.entity.js';
import { PaymentDetails } from '../payment/customer-payment.entity.js';
import { ReceivableInvoice, ReceivableInvoicePrimitives } from '../ledger/receivable-invoice.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';

// Los mismos identificadores de empresa y cliente que ventas.
export const NOW = new Date('2026-01-15T10:00:00.000Z');
export const TODAY = '2026-01-15';

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';

export const CUSTOMER = 'c1111111-1111-4111-8111-111111111111';
export const OTHER_CUSTOMER = 'c2222222-2222-4222-8222-222222222222';

export const INVOICE = 'f1111111-1111-4111-8111-111111111111';
export const OTHER_INVOICE = 'f2222222-2222-4222-8222-222222222222';

export const PAYMENT = 'd1111111-1111-4111-8111-111111111111';

// Una factura en dolares, la moneda de la empresa, emitida con el dolar a 36,50 Bs.
export const DOLLARS = { currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualExchangeRate: false };

// Las tasas del dia de un cobro en dolares: el dolar a 36,50 y dos decimales.
export function aPaymentRates(currency: Partial<DocumentRateSet> = {}, invoiceRates: Record<string, number> = {}, decimals = 2): PaymentRates {
  const own = DocumentCurrency.of({ currency: 'USD', exchangeRate: 36.5, baseCurrency: 'USD', baseExchangeRate: 36.5, manualRate: false, ...currency });

  return { currency: own, invoiceRates: { USD: 36.5, [own.currency]: own.exchangeRate!, ...invoiceRates }, decimals };
}

export function anInvoice(overrides: Partial<ReceivableInvoicePrimitives> = {}): ReceivableInvoice {
  return ReceivableInvoice.of({
    id: INVOICE,
    code: 'FAC000001',
    customerId: CUSTOMER,
    issueDate: '2026-01-05',
    dueDate: '2026-01-20',
    status: 'issued',
    total: 100,
    ...DOLLARS,
    paid: 0,
    ...overrides,
  });
}

export function paymentDetails(overrides: Partial<PaymentDetails> = {}): PaymentDetails {
  return {
    customerId: CUSTOMER,
    date: ReceivablesDate.of(TODAY),
    method: 'transfer',
    reference: 'TRF-001',
    notes: null,
    allocations: [{ id: 'a1000000-0000-4000-8000-000000000001', invoiceId: INVOICE, amount: 40 }],
    ...overrides,
  };
}
