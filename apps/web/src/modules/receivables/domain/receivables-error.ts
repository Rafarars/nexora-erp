import { AccessError } from '../../access/domain/access-error';
import { readableSalesError } from '../../sales/domain/sales-error';

const BY_CODE: Record<string, string> = {
  PaymentNotFoundError: 'Ese cobro ya no existe en esta empresa.',
  ReceivableCustomerNotFoundError: 'Ese cliente ya no existe en esta empresa.',
  ReceivableInvoiceNotFoundError: 'Una de las facturas ya no existe en esta empresa.',
  InvalidPaymentAmountError: 'Cada monto debe ser mayor que cero, sin más decimales de los que usa la empresa.',
  EmptyPaymentError: 'Indica cuánto se cobra de al menos una factura.',
  DuplicatePaymentInvoiceError: 'Cada factura puede aparecer una sola vez en el cobro.',
  InvalidPaymentMethodError: 'Elige cómo se cobró.',
  ReceivablesTextTooLongError: 'Uno de los textos es demasiado largo.',
  InvalidReceivablesDateError: 'La fecha no es válida.',
  FutureReceivablesDateError: 'Un cobro no puede tener fecha futura.',
  PaymentNotEditableError: 'Solo se puede editar un cobro en borrador.',
  PaymentNotConfirmableError: 'Solo se puede confirmar un cobro en borrador.',
  PaymentAlreadyCancelledError: 'El cobro ya está anulado.',
  InvoiceNotPayableError: 'Una de las facturas está anulada: ya no se cobra.',
  InvoiceOfAnotherCustomerError: 'Todas las facturas del cobro deben ser de su cliente.',
  PaymentExceedsBalanceError: 'El cobro aplica a una factura más de lo que debe.',
  PaymentBeforeInvoiceError: 'Un cobro no puede tener fecha anterior a las facturas que paga.',
  CreditNoteNotFoundError: 'Esa nota de crédito no existe en esta empresa.',
  CreditNoteNotEditableError: 'Solo se puede editar una nota de crédito en borrador.',
  CreditNoteNotConfirmableError: 'Solo se puede confirmar una nota de crédito en borrador.',
  CreditNoteAlreadyCancelledError: 'La nota de crédito ya está anulada.',
  CreditNoteReasonDetailRequiredError: 'Debes indicar el detalle del motivo cuando es "Otro".',
  EmptyCreditNoteError: 'La nota de crédito debe tener al menos una línea.',
  InvalidCreditNoteLineAmountError: 'Las cantidades y precios de la nota deben ser mayores a cero.',
  CreditQuotaExceededError: 'El monto de las notas de crédito supera el total de la factura.',
  CreditNoteCustomerMismatchError: 'El cobro con nota de crédito debe aplicarse al mismo cliente de la nota.',
  CreditNoteNotConfirmedError: 'La nota de crédito debe estar confirmada para aplicarse a un cobro.',
  CreditNoteExceededError: 'El monto excede el saldo de crédito disponible en la nota.',
  CreditNoteSourceRequiredError: 'Debes seleccionar la nota de crédito de origen para este cobro.',
  MoneyPaymentCannotHaveCreditSourceError: 'Un cobro con dinero no puede referenciar una nota de crédito.',
  CreditNoteWithApplicationsError: 'No se puede anular la nota: su crédito ya fue aplicado en otros cobros confirmados.',
  CreditNoteReturnCustomerMismatchError: 'El cliente de la nota no coincide con el de la devolución.',
  CreditNoteReturnNotConfirmedError: 'La devolución de venta debe estar confirmada para acreditarse.',
  SalesReturnAlreadyCreditedError: 'Esta devolución de venta ya ha sido acreditada por otra nota de crédito.',
  IssuePaymentCannotBeCancelledDirectlyError: 'El cobro generado por emisión de nota de crédito solo puede anularse anulando la nota.',
};

// Los mensajes de cuentas por cobrar y, para lo demas, los de ventas y los que estos heredan.
export function readableReceivablesError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('allocations'))) return 'Revisa los montos: cada uno debe ser un número.';
  }

  return readableSalesError(error, fallback);
}
