import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './sales.errors.js';

const ID = 'a1111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.CustomerNotFoundError(ID), NotFoundError],
  [new errors.SalesOrderNotFoundError(ID), NotFoundError],
  [new errors.DispatchNotFoundError(ID), NotFoundError],
  [new errors.InvoiceNotFoundError(ID), NotFoundError],
  [new errors.SalesItemNotFoundError(ID), NotFoundError],
  [new errors.SalesWarehouseNotFoundError(ID), NotFoundError],
  [new errors.DuplicateCustomerNameError('Delta', ID), ConflictError],
  [new errors.InvalidCustomerEmailError('x'), InvalidArgumentError],
  [new errors.InvalidPaymentTermError(400), InvalidArgumentError],
  [new errors.InvalidCreditLimitError(-1), InvalidArgumentError],
  [new errors.InactiveCustomerError(ID), ConflictError],
  [new errors.InactiveSalesItemError(ID), ConflictError],
  [new errors.SalesItemChangedError(ID), ConflictError],
  [new errors.InactiveSalesWarehouseError(ID), ConflictError],
  [new errors.ServiceNotSellableError(ID), InvalidArgumentError],
  [new errors.ItemNotSellableError(ID), ConflictError],
  [new errors.SalesUnitNotOfItemError(ID, ID), InvalidArgumentError],
  [new errors.InvalidSalesQuantityError(-1), InvalidArgumentError],
  [new errors.InvalidSalesPriceError(-1), InvalidArgumentError],
  [new errors.MissingSalesPriceError(ID), InvalidArgumentError],
  [new errors.SalesPriceBelowMinimumError(ID), InvalidArgumentError],
  [new errors.PriceListNotFoundError(ID), NotFoundError],
  [new errors.InactivePriceListError(ID), ConflictError],
  [new errors.InvalidTaxRateSnapshotError(120), InvalidArgumentError],
  [new errors.SalesTextTooLongError('Notes', 500), InvalidArgumentError],
  [new errors.EmptySalesTextError('CustomerName'), InvalidArgumentError],
  [new errors.InvalidSalesDateError('x'), InvalidArgumentError],
  [new errors.FutureSalesDateError('2099-01-01'), InvalidArgumentError],
  [new errors.EmptySalesOrderError(), InvalidArgumentError],
  [new errors.SalesOrderNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.SalesOrderNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.SalesOrderNotCancellableError(ID, 'cancelled'), ConflictError],
  [new errors.SalesOrderWithDispatchesError(ID), ConflictError],
  [new errors.SalesOrderNotDispatchableError(ID, 'draft'), ConflictError],
  [new errors.InsufficientAvailabilityError(ID, ID, 3, 5), ConflictError],
  [new errors.DispatchExceedsPendingError(ID, 3, 5), ConflictError],
  [new errors.EmptyDispatchError(), InvalidArgumentError],
  [new errors.DispatchLineNotInOrderError(ID), InvalidArgumentError],
  [new errors.DuplicateDispatchLineError(ID), InvalidArgumentError],
  [new errors.DispatchNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.DispatchNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.DispatchAlreadyCancelledError(ID), ConflictError],
  [new errors.InsufficientStockForDispatchError(ID), ConflictError],
  [new errors.DispatchInvoicedError(ID), ConflictError],
  [new errors.DispatchNotInvoiceableError(ID, 'draft'), ConflictError],
  [new errors.DispatchAlreadyInvoicedError(ID), ConflictError],
  [new errors.InvoiceAlreadyCancelledError(ID), ConflictError],
  [new errors.CustomerWithOverdueInvoicesError(ID), ConflictError],
  [new errors.CreditLimitExceededError(ID, 10, 5, 6), ConflictError],
  [new errors.InvoiceWithPaymentsError(ID), ConflictError],
];

describe('sales domain errors', () => {
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
