import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// ---------------------------------------------------------------- no encontrados
// Lo de otra empresa se responde igual que lo inexistente.

export class SupplierNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Supplier <${id}> does not exist.`);
  }
}

export class PurchaseOrderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Purchase order <${id}> does not exist.`);
  }
}

export class GoodsReceiptNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Goods receipt <${id}> does not exist.`);
  }
}

export class PurchaseItemNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Item <${id}> does not exist.`);
  }
}

export class PurchaseWarehouseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Warehouse <${id}> does not exist.`);
  }
}

// ---------------------------------------------------------------- proveedores

// Dos proveedores homonimos harian imposible saber a cual se le pide en un selector.
export class DuplicateSupplierNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(`Supplier <${name}> already exists in tenant <${tenantId}>.`, 'A supplier with that name already exists.');
  }
}

export class InvalidSupplierEmailError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Supplier email <${value}> is not valid.`, 'The supplier email is not valid.');
  }
}

export class InvalidPaymentTermError extends InvalidArgumentError {
  constructor(value: number) {
    super(`Payment term must be a whole number of days between 0 and 365, received <${value}>.`, 'The payment term must be a whole number of days, up to one year.');
  }
}

export class InactiveSupplierError extends ConflictError {
  constructor(id: string) {
    super(`Supplier <${id}> is inactive.`, 'The order uses a supplier that is inactive.');
  }
}

// La mercancia no puede llegar antes de pedirse. Importa mas desde que la fecha del documento
// viaja al kardex: un movimiento fechado antes que su orden se lista antes de que ella exista.
export class ReceiptBeforeOrderError extends ConflictError {
  constructor(date: string) {
    super(
      `Receipt dated <${date}> is earlier than its order.`,
      'The receipt cannot be dated before its purchase order.',
    );
  }
}

// Cerrar a un proveedor con mercancia todavia en camino dejaria esas ordenes sin quien las
// cierre. Mismo criterio que la bodega con documentos abiertos, en el catalogo.
export class SupplierWithOpenOrdersError extends ConflictError {
  constructor(id: string) {
    super(
      `Supplier <${id}> has open purchase orders.`,
      'The supplier has orders still expecting goods and cannot be deactivated.',
    );
  }
}

// ---------------------------------------------------------------- lineas y catalogo

// El articulo cambio su unidad desde que se escribio el documento, o en el instante entre
// revalidarlo y bloquearlo: confirmar con esas cantidades base contaria otra cosa. Se revisa el
// documento, se guarda y se vuelve a confirmar.
export class PurchaseItemChangedError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> changed while the document was being confirmed.`, 'An item changed since the document was written: review the document and save it again.');
  }
}

export class InactivePurchaseItemError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> is inactive.`, 'The document uses an item that is inactive.');
  }
}

export class InactivePurchaseWarehouseError extends ConflictError {
  constructor(id: string) {
    super(`Warehouse <${id}> is inactive.`, 'The document uses a warehouse that is inactive.');
  }
}

// En el H4 solo se compra lo que entra a una bodega; comprar servicios queda para despues.
export class ServiceNotPurchasableError extends InvalidArgumentError {
  constructor(id: string) {
    super(`Item <${id}> is a service and cannot be received into a warehouse.`, 'A service cannot be ordered: it has no stock to receive.');
  }
}

// El maestro dice que ese articulo no se compra: no deberia llegar a una orden.
export class ItemNotPurchasableError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> is not marked as purchasable.`, 'That item is not marked to be purchased.');
  }
}

export class PurchaseUnitNotOfItemError extends InvalidArgumentError {
  constructor(unitId: string, itemId: string) {
    super(`Unit <${unitId}> is not one of the units of item <${itemId}>.`, 'A line uses a unit that the item does not have.');
  }
}

// Media pieza no significa nada: si la unidad no admite fracciones, la linea tampoco.
export class PurchaseFractionalQuantityError extends InvalidArgumentError {
  constructor(quantity: number, abbreviation: string) {
    super(
      `Quantity <${quantity}> is not whole and unit <${abbreviation}> does not admit fractions.`,
      'That unit does not admit fractions: write a whole quantity.',
    );
  }
}

export class InvalidPurchaseQuantityError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A quantity must be greater than zero with at most four decimals, received <${value}>.`,
      'Quantities must be greater than zero with at most four decimals.',
    );
  }
}

export class InvalidPurchaseCostError extends InvalidArgumentError {
  constructor(value: number) {
    super(`A unit cost must be zero or more with at most six decimals, received <${value}>.`, 'Unit costs must be zero or more with at most six decimals.');
  }
}

export class InvalidTaxRateSnapshotError extends InvalidArgumentError {
  constructor(value: number) {
    super(`A tax rate must be between 0 and 100, received <${value}>.`, 'The tax rate of an item is not valid.');
  }
}

export class PurchasingTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} cannot be longer than ${max} characters.`, 'A value is too long.');
  }
}

export class EmptyPurchasingTextError extends InvalidArgumentError {
  constructor(name: string) {
    super(`${name} cannot be empty.`, 'A required value is empty.');
  }
}

export class InvalidPurchaseDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A date must be a real YYYY-MM-DD date, received <${value}>.`, 'The date is not valid.');
  }
}

export class FuturePurchaseDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is in the future.`, 'An order or a receipt cannot be dated in the future.');
  }
}

export class ExpectedDateBeforeOrderError extends InvalidArgumentError {
  constructor(expected: string, ordered: string) {
    super(`Expected date <${expected}> is before order date <${ordered}>.`, 'The expected date cannot be before the order date.');
  }
}

// ---------------------------------------------------------------- ordenes

export class EmptyPurchaseOrderError extends InvalidArgumentError {
  constructor() {
    super('A purchase order needs at least one line.', 'A purchase order needs at least one line.');
  }
}

export class PurchaseOrderNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Purchase order <${id}> is ${status} and can no longer be edited.`, 'Only a draft purchase order can be edited.');
  }
}

export class PurchaseOrderNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Purchase order <${id}> is ${status} and cannot be confirmed.`, 'Only a draft purchase order can be confirmed.');
  }
}

export class PurchaseOrderNotCancellableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Purchase order <${id}> is ${status} and cannot be cancelled.`, 'This purchase order can no longer be cancelled.');
  }
}

// Lo recibido ya esta en la bodega: anular la orden no lo devolveria al proveedor.
export class PurchaseOrderWithReceiptsError extends ConflictError {
  constructor(id: string) {
    super(`Purchase order <${id}> already has received goods.`, 'The purchase order already has received goods: cancel its receipts first.');
  }
}

export class PurchaseOrderNotReceivableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Purchase order <${id}> is ${status} and cannot receive goods.`, 'Goods can only be received for a confirmed order that is still pending.');
  }
}

// La regla central de la recepcion: no entra mas de lo que se pidio.
export class ReceiptExceedsPendingError extends ConflictError {
  constructor(orderLineId: string, pending: number, requested: number) {
    super(
      `Order line <${orderLineId}> has ${pending} pending and ${requested} was received.`,
      'A receipt cannot bring more than what is still pending on the order.',
    );
  }
}

// ---------------------------------------------------------------- entradas

export class EmptyGoodsReceiptError extends InvalidArgumentError {
  constructor() {
    super('A goods receipt needs at least one line.', 'A goods receipt needs at least one line.');
  }
}

export class ReceiptLineNotInOrderError extends InvalidArgumentError {
  constructor(orderLineId: string) {
    super(`Order line <${orderLineId}> is not part of the order.`, 'A receipt line does not belong to its order.');
  }
}

export class DuplicateReceiptLineError extends InvalidArgumentError {
  constructor(orderLineId: string) {
    super(`Order line <${orderLineId}> appears twice in the receipt.`, 'Each order line can appear only once in a receipt.');
  }
}

export class GoodsReceiptNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Goods receipt <${id}> is ${status} and can no longer be edited.`, 'Only a draft goods receipt can be edited.');
  }
}

export class GoodsReceiptNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Goods receipt <${id}> is ${status} and cannot be confirmed.`, 'Only a draft goods receipt can be confirmed.');
  }
}

export class GoodsReceiptAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Goods receipt <${id}> is already cancelled.`, 'The goods receipt is already cancelled.');
  }
}

// El inventario no deja revertir una entrada cuya mercancia ya salio.
export class ReceivedGoodsAlreadyUsedError extends ConflictError {
  constructor(id: string) {
    super(
      `Goods receipt <${id}> cannot be reversed: part of its goods already left the warehouse.`,
      'The goods of this receipt already left the warehouse: it cannot be cancelled.',
    );
  }
}

// Un servicio no entra a una bodega: se paga con la factura del proveedor, no con una entrada.
export class ServiceNotReceivableError extends InvalidArgumentError {
  constructor(itemId: string) {
    super(`Item <${itemId}> is a service and cannot be received.`, 'A service is not received into a warehouse.');
  }
}
