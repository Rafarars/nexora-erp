import { describe, expect, it } from 'vitest';
import {
  DuplicatePaymentInvoiceError,
  EmptyPaymentError,
  FutureReceivablesDateError,
  InvalidPaymentAmountError,
  InvalidPaymentMethodError,
  InvoiceNotPayableError,
  InvoiceOfAnotherCustomerError,
  PaymentAlreadyCancelledError,
  PaymentBeforeInvoiceError,
  PaymentExceedsBalanceError,
  PaymentNotConfirmableError,
  PaymentNotEditableError,
  ReceivableInvoiceNotFoundError,
  ReceivablesTextTooLongError,
} from '../errors/receivables.errors.js';
import { ReceivablesDate } from '../shared/receivables-date.vo.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { NOW, OTHER_CUSTOMER, OTHER_INVOICE, PAYMENT, TENANT_A, anInvoice, paymentDetails } from '../testing/receivables.mother.js';
import { CustomerPayment, PaymentDetails, PaymentId } from './customer-payment.entity.js';

const draft = (overrides: Partial<PaymentDetails> = {}) => CustomerPayment.draft(PaymentId.of(PAYMENT), TenantId.of(TENANT_A), 'COB000001', paymentDetails(overrides), NOW);
const allocation = (invoiceId: string, amount: number, n = 1) => ({ id: `a1000000-0000-4000-8000-00000000000${n}`, invoiceId, amount });

describe('CustomerPayment', () => {
  it('is born as a draft whose amount is the sum of what it applies', () => {
    const payment = draft({ allocations: [allocation(anInvoice().id, 40.1), allocation(OTHER_INVOICE, 0.2, 2)], reference: '  TRF-9 ', notes: '' });

    expect(payment.toPrimitives()).toMatchObject({ status: 'draft', amount: 40.3, reference: 'TRF-9', notes: null, paymentDate: '2026-01-15', method: 'transfer' });
  });

  it('refuses a payment with nothing to pay, a repeated invoice or an amount that is not money', () => {
    expect(() => draft({ allocations: [] })).toThrow(EmptyPaymentError);
    expect(() => draft({ allocations: [allocation(OTHER_INVOICE, 1), allocation(OTHER_INVOICE, 2, 2)] })).toThrow(DuplicatePaymentInvoiceError);

    for (const amount of [0, -5, 10.005, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => draft({ allocations: [allocation(OTHER_INVOICE, amount)] })).toThrow(InvalidPaymentAmountError);
    }
  });

  it('refuses an unknown method, a future date and texts that do not fit', () => {
    expect(() => draft({ method: 'bitcoin' })).toThrow(InvalidPaymentMethodError);
    expect(() => draft({ date: ReceivablesDate.of('2026-01-16') })).toThrow(FutureReceivablesDateError);
    expect(() => draft({ reference: 'x'.repeat(101) })).toThrow(ReceivablesTextTooLongError);
    expect(() => draft({ notes: 'x'.repeat(501) })).toThrow(ReceivablesTextTooLongError);
  });

  it('is edited only while it is a draft', () => {
    const payment = draft();

    payment.update(paymentDetails({ method: 'cash' }), NOW);
    expect(payment.toPrimitives().method).toBe('cash');

    payment.confirm([anInvoice()], NOW);
    expect(() => payment.update(paymentDetails(), NOW)).toThrow(PaymentNotEditableError);
  });

  it('confirms when every invoice accepts what it applies, up to the last cent', () => {
    const payment = draft({ allocations: [allocation(anInvoice().id, 60)] });

    payment.confirm([anInvoice({ paid: 40 })], NOW);

    expect(payment.toPrimitives()).toMatchObject({ status: 'confirmed', confirmedAt: NOW });
    expect(() => payment.confirm([anInvoice()], NOW)).toThrow(PaymentNotConfirmableError);
  });

  it('refuses to apply more than the invoice owes, even by one cent', () => {
    const payment = draft({ allocations: [allocation(anInvoice().id, 60.01)] });

    expect(() => payment.confirm([anInvoice({ paid: 40 })], NOW)).toThrow(PaymentExceedsBalanceError);
    expect(payment.currentStatus()).toBe('draft');
  });

  it('refuses invoices that are missing, cancelled, of another customer or later than the payment', () => {
    const payment = draft();

    expect(() => payment.confirm([], NOW)).toThrow(ReceivableInvoiceNotFoundError);
    expect(() => payment.confirm([anInvoice({ status: 'cancelled' })], NOW)).toThrow(InvoiceNotPayableError);
    expect(() => payment.confirm([anInvoice({ customerId: OTHER_CUSTOMER })], NOW)).toThrow(InvoiceOfAnotherCustomerError);
    expect(() => payment.confirm([anInvoice({ issueDate: '2026-01-16' })], NOW)).toThrow(PaymentBeforeInvoiceError);
  });

  it('is cancelled once, from draft or from confirmed', () => {
    const confirmed = draft();
    confirmed.confirm([anInvoice()], NOW);

    confirmed.cancel(NOW);
    draft().cancel(NOW);

    expect(confirmed.toPrimitives()).toMatchObject({ status: 'cancelled', cancelledAt: NOW });
    expect(() => confirmed.cancel(NOW)).toThrow(PaymentAlreadyCancelledError);
    expect(CustomerPayment.fromPrimitives(confirmed.toPrimitives()).toPrimitives()).toEqual(confirmed.toPrimitives());
  });
});
