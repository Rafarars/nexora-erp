import { describe, expect, it } from 'vitest';
import { ConcurrentModificationError } from '../../../../shared/domain/concurrent-modification.error.js';
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
import { NOW, OTHER_CUSTOMER, OTHER_INVOICE, PAYMENT, TENANT_A, TODAY, aPaymentRates, anInvoice, paymentDetails } from '../testing/receivables.mother.js';
import { CustomerPayment, PaymentDetails, PaymentId } from './customer-payment.entity.js';

const draft = (overrides: Partial<PaymentDetails> = {}) => CustomerPayment.draft(PaymentId.of(PAYMENT), TenantId.of(TENANT_A), 'COB000001', paymentDetails(overrides), INVOICES, aPaymentRates(), NOW, TODAY);
const allocation = (invoiceId: string, amount: number, n = 1) => ({ id: `a1000000-0000-4000-8000-00000000000${n}`, invoiceId, amount });

const INVOICES = [anInvoice(), anInvoice({ id: OTHER_INVOICE })];

describe('CustomerPayment', () => {
  // 40 USD de una factura emitida a 36,50, cobrados en euros el dia que el dolar esta a 38 y el euro a 40.
  it('receives in its currency what it applies to each invoice, through the bolivar, with the exchange difference', () => {
    const euros = aPaymentRates({ currency: 'EUR', exchangeRate: 40 }, { USD: 38 });
    const payment = CustomerPayment.draft(PaymentId.of(PAYMENT), TenantId.of(TENANT_A), 'COB000001', paymentDetails(), INVOICES, euros, NOW, TODAY);

    expect(payment.toPrimitives()).toMatchObject({
      currency: 'EUR',
      exchangeRate: 40,
      amount: 38,
      amountVes: 1520,
      allocations: [{ amount: 40, exchangeRate: 38, exchangeDifference: 60 }],
    });
  });

  it('has no exchange difference for an invoice written before the rates', () => {
    const legacy = [anInvoice({ exchangeRate: null, baseExchangeRate: null })];
    const payment = CustomerPayment.draft(PaymentId.of(PAYMENT), TenantId.of(TENANT_A), 'COB000001', paymentDetails(), legacy, aPaymentRates(), NOW, TODAY);

    expect(payment.toPrimitives().allocations).toMatchObject([{ amount: 40, exchangeRate: 36.5, exchangeDifference: null }]);
  });

  it('takes the decimals of the company', () => {
    const allocations = [{ id: 'a1000000-0000-4000-8000-000000000001', invoiceId: anInvoice().id, amount: 10.005 }];
    const draftWith = (decimals: number) =>
      CustomerPayment.draft(PaymentId.of(PAYMENT), TenantId.of(TENANT_A), 'COB000001', paymentDetails({ allocations }), INVOICES, aPaymentRates({}, {}, decimals), NOW, TODAY);

    expect(() => draftWith(2)).toThrow(InvalidPaymentAmountError);
    expect(draftWith(3).toPrimitives().amount).toBe(10.005);
  });

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

    payment.update(paymentDetails({ method: 'cash' }), INVOICES, aPaymentRates(), NOW, TODAY);
    expect(payment.toPrimitives().method).toBe('cash');

    payment.confirm([anInvoice()], aPaymentRates(), NOW, TODAY);
    expect(() => payment.update(paymentDetails(), INVOICES, aPaymentRates(), NOW, TODAY)).toThrow(PaymentNotEditableError);
  });

  // Las tasas del confirmador salen de la version leida: sobre otra, el cobro se rechaza.
  it('refuses to be confirmed over a version other than the one that was read', () => {
    const read = CustomerPayment.fromPrimitives(draft().toPrimitives());
    const locked = CustomerPayment.fromPrimitives(read.toPrimitives());

    locked.update(paymentDetails({ method: 'cash' }), INVOICES, aPaymentRates(), new Date(NOW.getTime() + 1000), TODAY);

    expect(() => locked.ensureUnchangedSince(read.version())).toThrow(ConcurrentModificationError);
    expect(() => CustomerPayment.fromPrimitives(read.toPrimitives()).ensureUnchangedSince(read.version())).not.toThrow();
  });

  it('confirms when every invoice accepts what it applies, up to the last cent', () => {
    const payment = draft({ allocations: [allocation(anInvoice().id, 60)] });

    payment.confirm([anInvoice({ paid: 40 })], aPaymentRates(), NOW, TODAY);

    expect(payment.toPrimitives()).toMatchObject({ status: 'confirmed', confirmedAt: NOW });
    expect(() => payment.confirm([anInvoice()], aPaymentRates(), NOW, TODAY)).toThrow(PaymentNotConfirmableError);
  });

  it('refuses to apply more than the invoice owes, even by one cent', () => {
    const payment = draft({ allocations: [allocation(anInvoice().id, 60.01)] });

    expect(() => payment.confirm([anInvoice({ paid: 40 })], aPaymentRates(), NOW, TODAY)).toThrow(PaymentExceedsBalanceError);
    expect(payment.currentStatus()).toBe('draft');
  });

  it('refuses invoices that are missing, cancelled, of another customer or later than the payment', () => {
    const payment = draft();

    expect(() => payment.confirm([], aPaymentRates(), NOW, TODAY)).toThrow(ReceivableInvoiceNotFoundError);
    expect(() => payment.confirm([anInvoice({ status: 'cancelled' })], aPaymentRates(), NOW, TODAY)).toThrow(InvoiceNotPayableError);
    expect(() => payment.confirm([anInvoice({ customerId: OTHER_CUSTOMER })], aPaymentRates(), NOW, TODAY)).toThrow(InvoiceOfAnotherCustomerError);
    expect(() => payment.confirm([anInvoice({ issueDate: '2026-01-16' })], aPaymentRates(), NOW, TODAY)).toThrow(PaymentBeforeInvoiceError);
  });

  it('is cancelled once, from draft or from confirmed', () => {
    const confirmed = draft();
    confirmed.confirm([anInvoice()], aPaymentRates(), NOW, TODAY);

    confirmed.cancel(NOW);
    draft().cancel(NOW);

    expect(confirmed.toPrimitives()).toMatchObject({ status: 'cancelled', cancelledAt: NOW });
    expect(() => confirmed.cancel(NOW)).toThrow(PaymentAlreadyCancelledError);
    expect(CustomerPayment.fromPrimitives(confirmed.toPrimitives()).toPrimitives()).toEqual(confirmed.toPrimitives());
  });
});
