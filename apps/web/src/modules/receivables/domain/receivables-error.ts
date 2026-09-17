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
};

// Los mensajes de cuentas por cobrar y, para lo demas, los de ventas y los que estos heredan.
export function readableReceivablesError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('allocations'))) return 'Revisa los montos: cada uno debe ser un número.';
  }

  return readableSalesError(error, fallback);
}
