import { AccessError } from '../../access/domain/access-error';
import { readablePurchasingError } from '../../purchasing/domain/purchasing-error';

const BY_CODE: Record<string, string> = {
  PaymentNotFoundError: 'Ese pago ya no existe en esta empresa.',
  PayableSupplierNotFoundError: 'Ese proveedor ya no existe en esta empresa.',
  PayableInvoiceNotFoundError: 'Una de las facturas ya no existe en esta empresa.',
  InvalidPaymentAmountError: 'Cada monto debe ser mayor que cero, sin más decimales de los que usa la empresa.',
  EmptyPaymentError: 'Indica cuánto se paga de al menos una factura.',
  DuplicatePaymentInvoiceError: 'Cada factura puede aparecer una sola vez en el pago.',
  InvalidPaymentMethodError: 'Elige cómo se pagó.',
  PayablesTextTooLongError: 'Uno de los textos es demasiado largo.',
  InvalidPayablesDateError: 'La fecha no es válida.',
  FuturePayablesDateError: 'La fecha no puede ser posterior a hoy.',
  PaymentNotEditableError: 'Solo se puede editar un pago en borrador.',
  PaymentNotConfirmableError: 'Solo se puede confirmar un pago en borrador.',
  PaymentAlreadyCancelledError: 'El pago ya está anulado.',
  InvoiceNotPayableError: 'Una de las facturas está anulada: ya no se paga.',
  InvoiceOfAnotherSupplierError: 'Todas las facturas del pago deben ser de su proveedor.',
  PaymentExceedsBalanceError: 'El pago aplica a una factura más de lo que debe.',
  PaymentBeforeInvoiceError: 'Un pago no puede tener fecha anterior a las facturas que paga.',
  DebitNoteNotFoundError: 'Esa nota de crédito no existe en esta empresa.',
  DebitNoteNotEditableError: 'Solo se puede editar una nota de crédito en borrador.',
  DebitNoteNotConfirmableError: 'Solo se puede confirmar una nota de crédito en borrador.',
  DebitNoteAlreadyCancelledError: 'La nota de crédito ya está anulada.',
  DebitNoteReasonDetailRequiredError: 'Debes indicar el detalle del motivo cuando es "Otro".',
  EmptyDebitNoteError: 'La nota de crédito debe tener al menos una línea.',
  InvalidDebitNoteLineAmountError: 'Las cantidades y precios de la nota deben ser mayores a cero.',
  DebitQuotaExceededError: 'El monto de las notas de crédito supera el total de la factura.',
  DebitNoteSupplierMismatchError: 'El pago con nota de crédito debe aplicarse al mismo proveedor de la nota.',
  DebitNoteNotConfirmedError: 'La nota de crédito debe estar confirmada para aplicarse a un pago.',
  DebitNoteExceededError: 'El monto excede el saldo de crédito disponible en la nota.',
  DebitNoteSourceRequiredError: 'Debes seleccionar la nota de crédito de origen para este pago.',
  MoneyPaymentCannotHaveDebitSourceError: 'Un pago con dinero no puede referenciar una nota de crédito.',
  DebitNoteWithApplicationsError: 'No se puede anular la nota: su crédito ya fue aplicado en otros pagos confirmados.',
  IssuePaymentCannotBeCancelledDirectlyError: 'El pago generado por emisión de nota de crédito solo puede anularse anulando la nota.',
};

export function readablePayablesError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('allocations'))) return 'Revisa los montos: cada uno debe ser un número.';
  }

  return readablePurchasingError(error, fallback);
}
