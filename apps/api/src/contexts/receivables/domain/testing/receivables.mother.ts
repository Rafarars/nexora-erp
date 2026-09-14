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

export function anInvoice(overrides: Partial<ReceivableInvoicePrimitives> = {}): ReceivableInvoice {
  return ReceivableInvoice.of({
    id: INVOICE,
    code: 'FAC000001',
    customerId: CUSTOMER,
    issueDate: '2026-01-05',
    dueDate: '2026-01-20',
    status: 'issued',
    total: 100,
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
