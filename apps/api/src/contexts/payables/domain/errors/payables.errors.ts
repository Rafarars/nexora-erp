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
  constructor(id: string, noteId?: string) {
    super(`Payment <${id}> was issued by a credit note${noteId ? ` <${noteId}>` : ''} and cannot be cancelled directly.`, 'A payment issued by a credit note must be cancelled through the credit note.');
  }
}

export class CreditNoteNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be edited.`, 'Only draft credit notes can be edited.');
  }
}

export class CreditNoteNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Credit note <${id}> is <${status}> and cannot be confirmed.`, 'Only draft credit notes can be confirmed.');
  }
}

export class CreditNoteAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Credit note <${id}> is already cancelled.`, 'The credit note is already cancelled.');
  }
}

export class CreditNoteReasonDetailRequiredError extends InvalidArgumentError {
  constructor() {
    super('Reason detail is required when reason is other.', 'Reason detail is required when reason is other.');
  }
}

export class EmptyCreditNoteError extends InvalidArgumentError {
  constructor() {
    super('A credit note needs at least one line.', 'The credit note needs at least one line.');
  }
}

export class InvalidCreditNoteLineAmountError extends InvalidArgumentError {
  constructor() {
    super('Credit note line quantity and price must be greater than zero.', 'Credit note line quantity and price must be greater than zero.');
  }
}

export class CreditNoteInvoiceTotalExceededError extends ConflictError {
  constructor(invoiceId: string, invoiceTotal: number, totalCredited: number) {
    super(
      `Credit notes for purchase invoice <${invoiceId}> total <${totalCredited}> which exceeds invoice total <${invoiceTotal}>.`,
      'The sum of credit notes cannot exceed the total amount of the invoice.',
    );
  }
}

export class CreditNoteReturnNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Purchase return <${id}> does not exist.`, 'The purchase return does not exist.');
  }
}

export class CreditNoteReturnNotConfirmedError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Purchase return <${id}> is <${status}> and cannot be credited.`, 'Only confirmed purchase returns can be credited.');
  }
}

export class CreditNoteReturnAlreadyCreditedError extends ConflictError {
  constructor(id: string) {
    super(`Purchase return <${id}> is already credited by another credit note.`, 'A purchase return can only be credited once.');
  }
}

export class CreditNoteReturnSupplierMismatchError extends ConflictError {
  constructor(returnId: string, supplierId: string) {
    super(`Purchase return <${returnId}> does not belong to supplier <${supplierId}>.`, 'The purchase return must belong to the supplier of the credit note.');
  }
}

export class CreditNoteWithApplicationsError extends ConflictError {
  constructor(id: string) {
    super(
      `Credit note <${id}> has confirmed payments applied and cannot be cancelled.`,
      'The credit note has payments applied and cannot be cancelled.',
    );
  }
}

export class CreditNoteLineInvoiceLineRequiredError extends InvalidArgumentError {
  constructor(lineNumber: number) {
    super(
      `Line <${lineNumber}> discounts merchandise and requires an invoice line reference.`,
      'Credit note line for merchandise requires an invoice line reference.',
    );
  }
}

export class CreditNoteLineInvoiceMismatchError extends ConflictError {
  constructor(lineId: string, invoiceId: string) {
    super(
      `Invoice line <${lineId}> does not belong to invoice <${invoiceId}>.`,
      'The referenced invoice line does not belong to the invoice.',
    );
  }
}

export class CreditNoteLineAmountExceedsInvoiceError extends ConflictError {
  constructor(lineId: string, lineAmount: number, invoiceLineAmount: number) {
    super(
      `Credit note line <${lineId}> amount <${lineAmount}> exceeds invoiced amount <${invoiceLineAmount}>.`,
      'Credit note line amount cannot exceed the invoiced amount for that line.',
    );
  }
}

export class CreditNoteReturnLinesNotFromInvoiceError extends ConflictError {
  constructor(returnId: string, invoiceId: string) {
    super(
      `Purchase return <${returnId}> contains lines not invoiced by invoice <${invoiceId}>.`,
      'Purchase return lines must correspond to goods receipt lines invoiced by the invoice.',
    );
  }
}

export class CreditNoteLineItemMismatchError extends ConflictError {
  constructor(lineId: string, invoiceItemId: string, noteItemId: string) {
    super(
      `Invoice line <${lineId}> item <${invoiceItemId}> does not match credit note item <${noteItemId}>.`,
      'The credit note line item must match the invoice line item.',
    );
  }
}

export class RevaluationSourceMovementNotFoundError extends NotFoundError {
  constructor(movementId: string) {
    super(`Movement <${movementId}> not found for revaluation.`, 'The inventory movement was not found.');
  }
}



