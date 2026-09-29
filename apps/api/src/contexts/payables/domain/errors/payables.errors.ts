import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// ---------------------------------------------------------------- no encontrados

export class PaymentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Payment <${id}> does not exist.`);
  }
}

export class PayableSupplierNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Supplier <${id}> does not exist.`);
  }
}

export class PayableInvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Purchase invoice <${id}> does not exist.`);
  }
}

// ---------------------------------------------------------------- datos del pago

export class InvalidPaymentAmountError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `Payment amount must be more than zero with no more decimals than the company uses, received <${value}>.`,
      'Each amount must be more than zero, with no more decimals than the company uses.',
    );
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

export class PayablesTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} is longer than <${max}> characters.`, 'A text field is too long.');
  }
}

export class InvalidPayablesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is not a valid calendar day.`, 'The date is not valid.');
  }
}

export class FuturePayablesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is in the future.`, 'The date cannot be in the future.');
  }
}

// ---------------------------------------------------------------- ciclo del pago

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

// ---------------------------------------------------------------- facturas del pago

export class InvoiceNotPayableError extends ConflictError {
  constructor(invoiceId: string) {
    super(`Purchase invoice <${invoiceId}> is not confirmed and cannot receive payments.`, 'Only confirmed purchase invoices can receive payments.');
  }
}

export class InvoiceOfAnotherSupplierError extends ConflictError {
  constructor(invoiceId: string, supplierId: string) {
    super(`Purchase invoice <${invoiceId}> does not belong to supplier <${supplierId}>.`, 'Every invoice in a payment must belong to its supplier.');
  }
}

export class PaymentExceedsBalanceError extends ConflictError {
  constructor(invoiceId: string, balance: number, amount: number) {
    super(`Purchase invoice <${invoiceId}> owes <${balance}> and the payment applies <${amount}>.`, 'The payment applies more than what the invoice owes.');
  }
}

export class PaymentBeforeInvoiceError extends ConflictError {
  constructor(invoiceId: string, date: string) {
    super(`Payment dated <${date}> is earlier than purchase invoice <${invoiceId}>.`, 'A payment cannot be dated before the invoices it pays.');
  }
}

// ---------------------------------------------------------------- notas de credito

export class CreditNoteNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Credit note <${id}> does not exist.`, 'The credit note does not exist.');
  }
}

export class CreditNoteNotConfirmedError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be spent.`, 'Only confirmed credit notes can be spent.');
  }
}

export class CreditNoteSupplierMismatchError extends ConflictError {
  constructor(id: string, supplierId: string) {
    super(`Credit note <${id}> does not belong to supplier <${supplierId}>.`, 'The credit note must belong to the supplier of the payment.');
  }
}

export class CreditNoteCurrencyMismatchError extends ConflictError {
  constructor(noteCurrency: string, paymentCurrency: string) {
    super(`Credit note currency <${noteCurrency}> does not match payment currency <${paymentCurrency}>.`, 'The credit note must be in the same currency as the payment.');
  }
}

export class CreditNoteExceededError extends ConflictError {
  constructor(id: string, available: number, requested: number) {
    super(`Credit note <${id}> has <${available}> available and <${requested}> was requested.`, 'The payment exceeds the available credit of the credit note.');
  }
}

export class CreditNotePaymentWithoutSourceError extends InvalidArgumentError {
  constructor() {
    super('A payment made with credit_note needs a creditSourceId.', 'A payment with credit note must reference the credit note.');
  }
}

export class MoneyPaymentWithCreditSourceError extends InvalidArgumentError {
  constructor() {
    super('Only credit_note payments can reference a credit source.', 'Only credit note payments can reference a credit note.');
  }
}

export class IssuePaymentCannotBeCancelledDirectlyError extends ConflictError {
  constructor(id: string) {
    super(`Payment <${id}> was issued by a credit note and cannot be cancelled directly.`, 'A payment issued by a credit note must be cancelled through the credit note.');
  }
}
