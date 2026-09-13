import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './inventory.errors.js';

const ID = 'a1111111-1111-4111-8111-111111111111';

const cases: Array<[DomainError, typeof DomainError]> = [
  [new errors.AdjustmentNotFoundError(ID), NotFoundError],
  [new errors.StockItemNotFoundError(ID), NotFoundError],
  [new errors.StockWarehouseNotFoundError(ID), NotFoundError],
  [new errors.InactiveStockItemError(ID), ConflictError],
  [new errors.InactiveStockWarehouseError(ID), ConflictError],
  [new errors.InsufficientStockError(ID, ID, 3, 5), ConflictError],
  [new errors.AdjustmentNotEditableError(ID, 'confirmed'), ConflictError],
  [new errors.AdjustmentNotConfirmableError(ID, 'cancelled'), ConflictError],
  [new errors.AdjustmentAlreadyCancelledError(ID), ConflictError],
  [new errors.ServiceHasNoStockError(ID), InvalidArgumentError],
  [new errors.UnitNotOfItemError(ID, ID), InvalidArgumentError],
  [new errors.EmptyAdjustmentError(), InvalidArgumentError],
  [new errors.InvalidQuantityError(-1), InvalidArgumentError],
  [new errors.InvalidUnitCostError(-1), InvalidArgumentError],
  [new errors.CostOnOutgoingLineError(1), InvalidArgumentError],
  [new errors.InvalidAdjustmentDateError('x'), InvalidArgumentError],
  [new errors.FutureAdjustmentDateError('2099-01-01'), InvalidArgumentError],
  [new errors.InventoryTextTooLongError('Notes', 500), InvalidArgumentError],
  [new errors.InvalidDirectionError('x'), InvalidArgumentError],
];

describe('inventory domain errors', () => {
  it('covers every error the context declares', () => {
    expect(cases).toHaveLength(Object.keys(errors).length);
  });

  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  // La existencia de otra persona no se le cuenta a nadie: el mensaje publico no la dice.
  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
  });
});
