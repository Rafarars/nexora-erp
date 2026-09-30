import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './payables.errors.js';

const ID = 'a1111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.PaymentNotFoundError(ID), NotFoundError],
  [new errors.PayableSupplierNotFoundError(ID), NotFoundError],
  [new errors.PayableInvoiceNotFoundError(ID), NotFoundError],
  [new errors.InvalidPaymentAmountError(-1), InvalidArgumentError],
  [new errors.EmptyPaymentError(), InvalidArgumentError],
  [new errors.DuplicatePaymentInvoiceError(ID), InvalidArgumentError],
  [new errors.InvalidPaymentMethodError('x'), InvalidArgumentError],
  [new errors.PayablesTextTooLongError('Notes', 500), InvalidArgumentError],
  [new errors.InvalidPayablesDateError('x'), InvalidArgumentError],
  [new errors.FuturePayablesDateError('2099-01-01'), InvalidArgumentError],
  [new errors.PaymentNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.PaymentNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.PaymentAlreadyCancelledError(ID), ConflictError],
  [new errors.InvoiceNotPayableError(ID), ConflictError],
  [new errors.InvoiceOfAnotherSupplierError(ID, ID), ConflictError],
  [new errors.PaymentExceedsBalanceError(ID, 5, 6), ConflictError],
  [new errors.PaymentBeforeInvoiceError(ID, '2026-01-01'), ConflictError],
  [new errors.CreditNoteNotFoundError(ID), NotFoundError],
  [new errors.CreditNoteNotConfirmedError(ID, 'draft'), ConflictError],
  [new errors.CreditNoteSupplierMismatchError(ID, ID), ConflictError],
  [new errors.CreditNoteCurrencyMismatchError('USD', 'VES'), ConflictError],
  [new errors.CreditNoteExceededError(ID, 10, 20), ConflictError],
  [new errors.CreditNotePaymentWithoutSourceError(), InvalidArgumentError],
  [new errors.MoneyPaymentWithCreditSourceError(), InvalidArgumentError],
  [new errors.IssuePaymentCannotBeCancelledDirectlyError(ID), ConflictError],
  [new errors.CreditNoteNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.CreditNoteNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.CreditNoteAlreadyCancelledError(ID), ConflictError],
  [new errors.CreditNoteReasonDetailRequiredError(), InvalidArgumentError],
  [new errors.EmptyCreditNoteError(), InvalidArgumentError],
  [new errors.InvalidCreditNoteLineAmountError(), InvalidArgumentError],
  [new errors.CreditNoteInvoiceTotalExceededError(ID, 100, 150), ConflictError],
  [new errors.CreditNoteReturnNotFoundError(ID), NotFoundError],
  [new errors.CreditNoteReturnNotConfirmedError(ID, 'draft'), ConflictError],
  [new errors.CreditNoteReturnAlreadyCreditedError(ID), ConflictError],
  [new errors.CreditNoteReturnSupplierMismatchError(ID, ID), ConflictError],
  [new errors.CreditNoteWithApplicationsError(ID), ConflictError],
  [new errors.CreditNoteLineInvoiceLineRequiredError(1), InvalidArgumentError],
  [new errors.CreditNoteLineInvoiceMismatchError(ID, ID), ConflictError],
  [new errors.CreditNoteLineAmountExceedsInvoiceError(ID, 100, 50), ConflictError],
  [new errors.CreditNoteReturnLinesNotFromInvoiceError(ID, ID), ConflictError],
  [new errors.CreditNoteLineItemMismatchError(ID, ID, ID), ConflictError],
  [new errors.RevaluationSourceMovementNotFoundError(ID), NotFoundError],
];

describe('payables domain errors', () => {
  it('covers every error the context declares', () => {
    expect(cases).toHaveLength(Object.keys(errors).length);
  });

  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
  });
});
