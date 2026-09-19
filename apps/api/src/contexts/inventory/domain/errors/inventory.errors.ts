import {
  ConflictError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../../shared/domain/domain.error.js';

export class AdjustmentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Adjustment <${id}> does not exist.`);
  }
}

// Un articulo o una bodega que el ajuste no encuentra en la empresa se responde como
// inexistente, igual que en sus maestros.
export class StockItemNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Item <${id}> does not exist.`);
  }
}

export class StockWarehouseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Warehouse <${id}> does not exist.`);
  }
}

// Guarda el articulo: compras y ventas lo traducen a su propio error sin perder cual fue.
export class InactiveStockItemError extends ConflictError {
  constructor(readonly itemId: string) {
    super(`Item <${itemId}> is inactive.`, 'The adjustment uses an item that is inactive.');
  }
}

// El articulo cambio su unidad desde que se escribio el documento, o en el instante entre
// revalidarlo y bloquearlo: confirmar con esas cantidades base contaria otra cosa. Se revisa el
// documento, se guarda y se vuelve a confirmar.
export class StockItemChangedError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> changed while the document was being confirmed.`, 'An item changed since the document was written: review the document and save it again.');
  }
}

export class InactiveStockWarehouseError extends ConflictError {
  constructor(id: string) {
    super(`Warehouse <${id}> is inactive.`, 'The adjustment uses a warehouse that is inactive.');
  }
}

// Un servicio se compra y se vende, pero no se guarda en ninguna bodega.
export class ServiceHasNoStockError extends InvalidArgumentError {
  constructor(readonly itemId: string) {
    super(`Item <${itemId}> is a service and has no stock.`, 'A service cannot be adjusted: it has no stock.');
  }
}

export class UnitNotOfItemError extends InvalidArgumentError {
  constructor(unitId: string, itemId: string) {
    super(`Unit <${unitId}> is not one of the units of item <${itemId}>.`, 'A line uses a unit that the item does not have.');
  }
}

// Media pieza no significa nada: si la unidad no admite fracciones, la linea tampoco.
export class FractionalQuantityError extends InvalidArgumentError {
  constructor(quantity: number, abbreviation: string) {
    super(
      `Quantity <${quantity}> is not whole and unit <${abbreviation}> does not admit fractions.`,
      'That unit does not admit fractions: write a whole quantity.',
    );
  }
}

// La regla central del inventario: no se saca lo que no hay.
export class InsufficientStockError extends ConflictError {
  constructor(itemId: string, warehouseId: string, available: number, requested: number) {
    super(
      `Item <${itemId}> in warehouse <${warehouseId}> has ${available} and ${requested} was requested.`,
      'There is not enough stock for this operation.',
    );
  }
}

export class EmptyAdjustmentError extends InvalidArgumentError {
  constructor() {
    super('An adjustment needs at least one line.', 'An adjustment needs at least one line.');
  }
}

export class InvalidQuantityError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A quantity must be greater than zero with at most four decimals, received <${value}>.`,
      'Quantities must be greater than zero with at most four decimals.',
    );
  }
}

export class InvalidUnitCostError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A unit cost must be zero or more with at most six decimals, received <${value}>.`,
      'Unit costs must be zero or more with at most six decimals.',
    );
  }
}

// Una salida se valora al costo promedio vigente: un costo escrito en ella no significaria
// nada y confundiria a quien lee el documento.
export class CostOnOutgoingLineError extends InvalidArgumentError {
  constructor(lineNumber: number) {
    super(`Line ${lineNumber} is outgoing and cannot carry a unit cost.`, 'Only incoming lines can carry a unit cost.');
  }
}

// Una entrada sin costo se valora al promedio, y aqui no hay ninguno: ni la bodega ni el resto
// de la empresa guardan existencia de este articulo. Valorarla en cero la regalaria, asi que se
// pide el costo. Es hermano de InsufficientStockError: los dos aparecen al publicar, cuando ya
// se sabe lo que hay.
export class UnknownEntryCostError extends ConflictError {
  constructor(itemId: string) {
    super(
      `Item <${itemId}> has no stock anywhere to value an entry without a unit cost.`,
      'Write the unit cost: there is no stock of this item to value the entry with.',
    );
  }
}

export class InvalidAdjustmentDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`An adjustment date must be a real YYYY-MM-DD date, received <${value}>.`, 'The adjustment date is not valid.');
  }
}

export class FutureAdjustmentDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Adjustment date <${value}> is in the future.`, 'An adjustment cannot be dated in the future.');
  }
}

export class AdjustmentNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Adjustment <${id}> is ${status} and can no longer be edited.`, 'Only a draft adjustment can be edited.');
  }
}

export class AdjustmentNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Adjustment <${id}> is ${status} and cannot be confirmed.`, 'Only a draft adjustment can be confirmed.');
  }
}

export class AdjustmentAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Adjustment <${id}> is already cancelled.`, 'The adjustment is already cancelled.');
  }
}

export class InventoryTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} cannot be longer than ${max} characters.`, 'A value is too long.');
  }
}

export class InvalidDirectionError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A line direction must be in or out, received <${value}>.`, 'Each line must be an entry or an exit.');
  }
}
