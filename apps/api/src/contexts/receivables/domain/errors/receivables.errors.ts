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
    super(`Payment amount must be more than zero with no more decimals than the company uses, received <${value}>.`, 'Each amount must be more than zero, with no more decimals than the company uses.');
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

// ---------------------------------------------------------------- notas de credito

export class CreditNoteNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Credit note <${id}> does not exist.`, 'The credit note does not exist.');
  }
}

export class CreditNoteNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be edited.`, 'Only a draft credit note can be edited.');
  }
}

export class CreditNoteNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be confirmed.`, 'Only a draft credit note can be confirmed.');
  }
}

export class CreditNoteAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Credit note <${id}> is already cancelled.`, 'The credit note is already cancelled.');
  }
}

export class CreditNoteReasonDetailRequiredError extends InvalidArgumentError {
  constructor() {
    super("Credit note with reason 'other' requires reasonDetail.", 'The reason detail is required.');
  }
}

export class CreditNoteWithApplicationsError extends ConflictError {
  constructor(id: string) {
    super(`Credit note <${id}> has been applied to confirmed payments.`, 'The credit note has been applied to payments.');
  }
}

export class CreditNotePaymentWithoutSourceError extends InvalidArgumentError {
  constructor() {
    super('A credit note payment must specify creditSourceId.', 'A credit note payment requires a credit note source.');
  }
}

export class MoneyPaymentWithCreditSourceError extends InvalidArgumentError {
  constructor() {
    super('A money payment cannot specify creditSourceId.', 'A payment with money cannot specify a credit note source.');
  }
}

export class CreditNoteNotConfirmedError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be used as credit.`, 'The credit note is not confirmed.');
  }
}

export class CreditNoteCustomerMismatchError extends ConflictError {
  constructor(noteId: string, customerId: string) {
    super(`Credit note <${noteId}> belongs to another customer <${customerId}>.`, 'The credit note belongs to a different customer.');
  }
}

export class CreditNoteExceededError extends ConflictError {
  constructor(id: string, available: number, requested: number) {
    super(`Credit note <${id}> has only <${available}> available, requested <${requested}>.`, 'The requested amount exceeds the credit note balance.');
  }
}

export class CreditNoteCurrencyMismatchError extends ConflictError {
  constructor(noteCurrency: string, paymentCurrency: string) {
    super(`Credit note currency <${noteCurrency}> does not match payment currency <${paymentCurrency}>.`, 'The credit note currency does not match the payment currency.');
  }
}

export class CreditNoteReturnCustomerMismatchError extends ConflictError {
  constructor(returnId: string, customerId: string) {
    super(`Sales return <${returnId}> belongs to another customer <${customerId}>.`, 'The sales return belongs to a different customer.');
  }
}

export class CreditNoteReturnNotConfirmedError extends ConflictError {
  constructor(returnId: string, status: string) {
    super(`Sales return <${returnId}> is <${status}> and cannot be credited.`, 'The sales return is not confirmed.');
  }
}

export class CreditNoteReturnAlreadyCreditedError extends ConflictError {
  constructor(returnId: string) {
    super(`Sales return <${returnId}> has already been credited by another credit note.`, 'The sales return has already been credited.');
  }
}

export class CreditNoteReturnOrderMismatchError extends ConflictError {
  constructor(returnId: string, invoiceId: string) {
    super(`Sales return <${returnId}> does not belong to the same order as invoice <${invoiceId}>.`, 'The sales return does not belong to the same order as the invoice.');
  }
}

export class CreditQuotaExceededError extends ConflictError {
  constructor(invoiceId: string, available: number, requested: number) {
    super(`Invoice <${invoiceId}> has only <${available}> credit quota, requested <${requested}>.`, 'The credit note exceeds the invoice balance.');
  }
}

export class IssuePaymentCannotBeCancelledDirectlyError extends ConflictError {
  constructor(paymentId: string, noteId: string) {
    super(`Payment <${paymentId}> is the issue payment of credit note <${noteId}> and cannot be cancelled directly.`, 'The issue payment cannot be cancelled directly.');
  }
}

export class EmptyCreditNoteError extends InvalidArgumentError {
  constructor() {
    super('A credit note needs at least one line.', 'The credit note needs at least one line.');
  }
}

export class InvalidCreditNoteLineAmountError extends InvalidArgumentError {
  constructor() {
    super('Credit note line quantity and unit price must be positive.', 'Line amounts must be greater than zero.');
  }
}
