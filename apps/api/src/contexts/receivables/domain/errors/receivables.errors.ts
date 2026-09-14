import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// ---------------------------------------------------------------- no encontrados
// Lo de otra empresa se responde igual que lo inexistente.

export class PaymentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Payment <${id}> does not exist.`);
  }
}

export class ReceivableCustomerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Customer <${id}> does not exist.`);
  }
}

export class ReceivableInvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Invoice <${id}> does not exist.`);
  }
}

// ---------------------------------------------------------------- datos del cobro

export class InvalidPaymentAmountError extends InvalidArgumentError {
  constructor(value: number) {
    super(`Payment amount must be more than zero with up to two decimals, received <${value}>.`, 'Each amount must be more than zero, with up to two decimals.');
  }
}

export class EmptyPaymentError extends InvalidArgumentError {
  constructor() {
    super('A payment needs at least one invoice.', 'The payment needs at least one invoice.');
  }
}

export class DuplicatePaymentInvoiceError extends InvalidArgumentError {
  constructor(invoiceId: string) {
    super(`Invoice <${invoiceId}> appears twice in the payment.`, 'Each invoice can appear only once in a payment.');
  }
}

export class InvalidPaymentMethodError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Payment method <${value}> is not valid.`, 'The payment method is not valid.');
  }
}

export class ReceivablesTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} is longer than <${max}> characters.`, 'A text field is too long.');
  }
}

export class InvalidReceivablesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is not a valid calendar day.`, 'The date is not valid.');
  }
}

export class FutureReceivablesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is in the future.`, 'The date cannot be in the future.');
  }
}

// ---------------------------------------------------------------- ciclo del cobro

export class PaymentNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Payment <${id}> is <${status}> and cannot be edited.`, 'Only a draft payment can be edited.');
  }
}

export class PaymentNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Payment <${id}> is <${status}> and cannot be confirmed.`, 'Only a draft payment can be confirmed.');
  }
}

export class PaymentAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Payment <${id}> is already cancelled.`, 'The payment is already cancelled.');
  }
}

// ---------------------------------------------------------------- facturas del cobro

export class InvoiceNotPayableError extends ConflictError {
  constructor(invoiceId: string) {
    super(`Invoice <${invoiceId}> is cancelled and cannot receive payments.`, 'A cancelled invoice cannot receive payments.');
  }
}

export class InvoiceOfAnotherCustomerError extends ConflictError {
  constructor(invoiceId: string, customerId: string) {
    super(`Invoice <${invoiceId}> does not belong to customer <${customerId}>.`, 'Every invoice in a payment must belong to its customer.');
  }
}

export class PaymentExceedsBalanceError extends ConflictError {
  constructor(invoiceId: string, balance: number, amount: number) {
    super(`Invoice <${invoiceId}> owes <${balance}> and the payment applies <${amount}>.`, 'The payment applies more than what the invoice owes.');
  }
}

export class PaymentBeforeInvoiceError extends ConflictError {
  constructor(invoiceId: string, date: string) {
    super(`Payment dated <${date}> is earlier than invoice <${invoiceId}>.`, 'A payment cannot be dated before the invoices it pays.');
  }
}
