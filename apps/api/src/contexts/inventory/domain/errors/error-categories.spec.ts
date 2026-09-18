import { describe, expect, it } from 'vitest';
import { ConflictError, DomainError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';
import * as errors from './inventory.errors.js';
import * as itemErrors from './item.errors.js';

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
  [new errors.StockItemChangedError(ID), ConflictError],
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

const itemCases: Array<[DomainError, typeof DomainError]> = [
  [new itemErrors.ItemNotFoundError(ID), NotFoundError],
  [new itemErrors.CategoryNotFoundError(ID), NotFoundError],
  [new itemErrors.TaxNotFoundError(ID), NotFoundError],
  [new itemErrors.MeasurementUnitNotFoundError(ID), NotFoundError],
  [new itemErrors.DuplicateSkuError('AGUA-500', ID), ConflictError],
  [new itemErrors.DuplicateBarcodeError('7591234567890', ID), ConflictError],
  [new itemErrors.InactiveReferenceError('Category', ID), ConflictError],
  [new itemErrors.ItemWithStockError(ID), ConflictError],
  [new itemErrors.ItemWithMovementsError(ID), ConflictError],
  [new itemErrors.ItemInOpenDocumentsError(ID), ConflictError],
  [new itemErrors.ItemUnitInOpenDocumentsError(ID, ID), ConflictError],
  [new itemErrors.InvalidConversionFactorError(-1), InvalidArgumentError],
  [new itemErrors.InvalidSkuError('A B'), InvalidArgumentError],
  [new itemErrors.InvalidBarcodeError('A B'), InvalidArgumentError],
  [new itemErrors.InvalidReorderRuleError('a warehouse appears more than once.'), InvalidArgumentError],
  [new itemErrors.InvalidItemPriceError('a price list appears more than once.'), InvalidArgumentError],
  [new itemErrors.PriceBelowMinimumError(1, 2), InvalidArgumentError],
  [new itemErrors.PriceListNotFoundError(ID), NotFoundError],
  [new itemErrors.InvalidItemTypeError('serialized'), InvalidArgumentError],
  [new itemErrors.InvalidItemUnitsError('no base'), InvalidArgumentError],
  [new itemErrors.InvalidItemCodeError('nope'), InvalidArgumentError],
];

describe('item master errors', () => {
  it('covers every error the item master declares', () => {
    expect(itemCases).toHaveLength(Object.keys(itemErrors).length);
  });

  it.each(itemCases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
  });

  it.each(itemCases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]|\d/);
    expect(error.publicMessage).not.toContain('AGUA-500');
  });

  // La interfaz traduce por el nombre de la clase: moverla de contexto no lo cambia.
  it('names itself with its concrete class', () => {
    expect(new itemErrors.DuplicateSkuError('AGUA-500', ID).name).toBe('DuplicateSkuError');
  });
});
