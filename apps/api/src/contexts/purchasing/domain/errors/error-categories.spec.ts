import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './purchasing.errors.js';

const ID = 'a1111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.SupplierNotFoundError(ID), NotFoundError],
  [new errors.PurchaseOrderNotFoundError(ID), NotFoundError],
  [new errors.GoodsReceiptNotFoundError(ID), NotFoundError],
  [new errors.PurchaseItemNotFoundError(ID), NotFoundError],
  [new errors.PurchaseWarehouseNotFoundError(ID), NotFoundError],
  [new errors.DuplicateSupplierNameError('Andina', ID), ConflictError],
  [new errors.InvalidSupplierEmailError('x'), InvalidArgumentError],
  [new errors.InvalidPaymentTermError(400), InvalidArgumentError],
  [new errors.InactiveSupplierError(ID), ConflictError],
  [new errors.InactivePurchaseItemError(ID), ConflictError],
  [new errors.InactivePurchaseWarehouseError(ID), ConflictError],
  [new errors.ServiceNotPurchasableError(ID), InvalidArgumentError],
  [new errors.ItemNotPurchasableError(ID), ConflictError],
  [new errors.PurchaseUnitNotOfItemError(ID, ID), InvalidArgumentError],
  [new errors.PurchaseItemChangedError(ID), ConflictError],
  [new errors.InvalidPurchaseQuantityError(-1), InvalidArgumentError],
  [new errors.InvalidPurchaseCostError(-1), InvalidArgumentError],
  [new errors.InvalidTaxRateSnapshotError(120), InvalidArgumentError],
  [new errors.PurchasingTextTooLongError('Notes', 500), InvalidArgumentError],
  [new errors.EmptyPurchasingTextError('SupplierName'), InvalidArgumentError],
  [new errors.InvalidPurchaseDateError('x'), InvalidArgumentError],
  [new errors.FuturePurchaseDateError('2099-01-01'), InvalidArgumentError],
  [new errors.ExpectedDateBeforeOrderError('2026-01-01', '2026-01-02'), InvalidArgumentError],
  [new errors.EmptyPurchaseOrderError(), InvalidArgumentError],
  [new errors.PurchaseOrderNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.PurchaseOrderNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.PurchaseOrderNotCancellableError(ID, 'cancelled'), ConflictError],
  [new errors.PurchaseOrderWithReceiptsError(ID), ConflictError],
  [new errors.PurchaseOrderNotReceivableError(ID, 'draft'), ConflictError],
  [new errors.ReceiptExceedsPendingError(ID, 3, 5), ConflictError],
  [new errors.EmptyGoodsReceiptError(), InvalidArgumentError],
  [new errors.ReceiptLineNotInOrderError(ID), InvalidArgumentError],
  [new errors.DuplicateReceiptLineError(ID), InvalidArgumentError],
  [new errors.GoodsReceiptNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.GoodsReceiptNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.GoodsReceiptAlreadyCancelledError(ID), ConflictError],
  [new errors.ReceivedGoodsAlreadyUsedError(ID), ConflictError],
];

describe('purchasing domain errors', () => {
  it('covers every error the context declares', () => {
    expect(cases).toHaveLength(Object.keys(errors).length);
  });

  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  // Ni el proveedor, ni lo pendiente, ni cantidades: nada de eso sale al cliente.
  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
  });
});
