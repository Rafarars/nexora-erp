import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

// ---------------------------------------------------------------- no encontrados
// Lo de otra empresa se responde igual que lo inexistente.

export class CustomerNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Customer <${id}> does not exist.`);
  }
}

export class SalesOrderNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Sales order <${id}> does not exist.`);
  }
}

export class DispatchNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Dispatch <${id}> does not exist.`);
  }
}

export class InvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Invoice <${id}> does not exist.`);
  }
}

export class SalesItemNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Item <${id}> does not exist.`);
  }
}

export class SalesWarehouseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Warehouse <${id}> does not exist.`);
  }
}

// ---------------------------------------------------------------- clientes

export class DuplicateCustomerNameError extends ConflictError {
  constructor(name: string, tenantId: string) {
    super(`Customer <${name}> already exists in tenant <${tenantId}>.`, 'A customer with that name already exists.');
  }
}

export class InvalidCustomerEmailError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Customer email <${value}> is not valid.`, 'The customer email is not valid.');
  }
}

export class InvalidPaymentTermError extends InvalidArgumentError {
  constructor(value: number) {
    super(`Payment term must be a whole number of days between 0 and 365, received <${value}>.`, 'The payment term must be a whole number of days, up to one year.');
  }
}

export class InvalidCreditLimitError extends InvalidArgumentError {
  constructor(value: number) {
    super(`Credit limit must be zero or more with up to two decimals, received <${value}>.`, 'The credit limit must be an amount of zero or more.');
  }
}

export class InactiveCustomerError extends ConflictError {
  constructor(id: string) {
    super(`Customer <${id}> is inactive.`, 'The order uses a customer that is inactive.');
  }
}

// ---------------------------------------------------------------- lineas y catalogo

// El articulo cambio su unidad desde que se escribio el documento, o en el instante entre
// revalidarlo y bloquearlo: confirmar con esas cantidades base contaria otra cosa. Se revisa el
// documento, se guarda y se vuelve a confirmar.
export class SalesItemChangedError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> changed while the document was being confirmed.`, 'An item changed since the document was written: review the document and save it again.');
  }
}

export class InactiveSalesItemError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> is inactive.`, 'The document uses an item that is inactive.');
  }
}

export class InactiveSalesWarehouseError extends ConflictError {
  constructor(id: string) {
    super(`Warehouse <${id}> is inactive.`, 'The document uses a warehouse that is inactive.');
  }
}

// En el H5 solo se vende lo que sale de una bodega; vender servicios queda para despues.
// El maestro dice que ese articulo no se vende: no deberia llegar a un pedido.
export class ItemNotSellableError extends ConflictError {
  constructor(id: string) {
    super(`Item <${id}> is not marked as sellable.`, 'That item is not marked to be sold.');
  }
}

export class ServiceNotSellableError extends InvalidArgumentError {
  constructor(id: string) {
    super(`Item <${id}> is a service and cannot be dispatched from a warehouse.`, 'A service cannot be ordered: it has no stock to dispatch.');
  }
}

export class SalesUnitNotOfItemError extends InvalidArgumentError {
  constructor(unitId: string, itemId: string) {
    super(`Unit <${unitId}> is not one of the units of item <${itemId}>.`, 'A line uses a unit that the item does not have.');
  }
}

export class InvalidSalesQuantityError extends InvalidArgumentError {
  constructor(value: number) {
    super(`A quantity must be greater than zero with at most four decimals, received <${value}>.`, 'Quantities must be greater than zero with at most four decimals.');
  }
}

export class InvalidSalesPriceError extends InvalidArgumentError {
  constructor(value: number) {
    super(`A unit price must be zero or more with at most six decimals, received <${value}>.`, 'Unit prices must be zero or more with at most six decimals.');
  }
}

export class InvalidTaxRateSnapshotError extends InvalidArgumentError {
  constructor(value: number) {
    super(`A tax rate must be between 0 and 100, received <${value}>.`, 'The tax rate of an item is not valid.');
  }
}

export class SalesTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} cannot be longer than ${max} characters.`, 'A value is too long.');
  }
}

export class EmptySalesTextError extends InvalidArgumentError {
  constructor(name: string) {
    super(`${name} cannot be empty.`, 'A required value is empty.');
  }
}

export class InvalidSalesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A date must be a real YYYY-MM-DD date, received <${value}>.`, 'The date is not valid.');
  }
}

export class FutureSalesDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Date <${value}> is in the future.`, 'A sales document cannot be dated in the future.');
  }
}

// ---------------------------------------------------------------- pedidos

export class EmptySalesOrderError extends InvalidArgumentError {
  constructor() {
    super('A sales order needs at least one line.', 'A sales order needs at least one line.');
  }
}

export class SalesOrderNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Sales order <${id}> is ${status} and can no longer be edited.`, 'Only a draft sales order can be edited.');
  }
}

export class SalesOrderNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Sales order <${id}> is ${status} and cannot be confirmed.`, 'Only a draft sales order can be confirmed.');
  }
}

export class SalesOrderNotCancellableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Sales order <${id}> is ${status} and cannot be cancelled.`, 'This sales order can no longer be cancelled.');
  }
}

// Lo despachado ya salio de la bodega: anular el pedido no lo traeria de vuelta.
export class SalesOrderWithDispatchesError extends ConflictError {
  constructor(id: string) {
    super(`Sales order <${id}> already has dispatched goods.`, 'The sales order already has dispatched goods: cancel its dispatches first.');
  }
}

export class SalesOrderNotDispatchableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Sales order <${id}> is ${status} and cannot dispatch goods.`, 'Goods can only be dispatched for a confirmed order that is still pending.');
  }
}

// La regla central del pedido: no se reserva lo que no esta disponible.
export class InsufficientAvailabilityError extends ConflictError {
  constructor(itemId: string, warehouseId: string, available: number, requested: number) {
    super(
      `Item <${itemId}> in warehouse <${warehouseId}> has ${available} available and ${requested} was ordered.`,
      'There is not enough available stock to reserve for this order.',
    );
  }
}

// La regla central del despacho: no sale mas de lo vendido.
export class DispatchExceedsPendingError extends ConflictError {
  constructor(orderLineId: string, pending: number, requested: number) {
    super(`Order line <${orderLineId}> has ${pending} pending and ${requested} was dispatched.`, 'A dispatch cannot take more than what is still pending on the order.');
  }
}

// ---------------------------------------------------------------- despachos

export class EmptyDispatchError extends InvalidArgumentError {
  constructor() {
    super('A dispatch needs at least one line.', 'A dispatch needs at least one line.');
  }
}

export class DispatchLineNotInOrderError extends InvalidArgumentError {
  constructor(orderLineId: string) {
    super(`Order line <${orderLineId}> is not part of the order.`, 'A dispatch line does not belong to its order.');
  }
}

export class DuplicateDispatchLineError extends InvalidArgumentError {
  constructor(orderLineId: string) {
    super(`Order line <${orderLineId}> appears twice in the dispatch.`, 'Each order line can appear only once in a dispatch.');
  }
}

export class DispatchNotEditableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Dispatch <${id}> is ${status} and can no longer be edited.`, 'Only a draft dispatch can be edited.');
  }
}

export class DispatchNotConfirmableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Dispatch <${id}> is ${status} and cannot be confirmed.`, 'Only a draft dispatch can be confirmed.');
  }
}

export class DispatchAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Dispatch <${id}> is already cancelled.`, 'The dispatch is already cancelled.');
  }
}

// El inventario no deja sacar lo que no hay: alguien saco la existencia reservada.
export class InsufficientStockForDispatchError extends ConflictError {
  constructor(id: string) {
    super(`Dispatch <${id}> cannot leave: the warehouse no longer has that stock.`, 'The warehouse no longer has enough stock for this dispatch.');
  }
}

export class DispatchInvoicedError extends ConflictError {
  constructor(id: string) {
    super(`Dispatch <${id}> has an issued invoice.`, 'The dispatch is invoiced: cancel its invoice first.');
  }
}

// ---------------------------------------------------------------- facturas

export class DispatchNotInvoiceableError extends ConflictError {
  constructor(id: string, status: string) {
    super(`Dispatch <${id}> is ${status} and cannot be invoiced.`, 'Only a confirmed dispatch can be invoiced.');
  }
}

export class DispatchAlreadyInvoicedError extends ConflictError {
  constructor(id: string) {
    super(`Dispatch <${id}> already has an issued invoice.`, 'The dispatch already has an issued invoice.');
  }
}

export class InvoiceAlreadyCancelledError extends ConflictError {
  constructor(id: string) {
    super(`Invoice <${id}> is already cancelled.`, 'The invoice is already cancelled.');
  }
}

// ---------------------------------------------------------------- credito y cobros

export class CustomerWithOverdueInvoicesError extends ConflictError {
  constructor(customerId: string) {
    super(`Customer <${customerId}> has overdue invoices and cannot be invoiced on credit.`, 'The customer has overdue invoices and cannot be invoiced on credit.');
  }
}

export class CreditLimitExceededError extends ConflictError {
  constructor(customerId: string, limit: number, balance: number, total: number) {
    super(
      `Customer <${customerId}> owes <${balance}> and the invoice adds <${total}>, over the credit limit <${limit}>.`,
      'The invoice exceeds the customer credit limit.',
    );
  }
}

export class InvoiceWithPaymentsError extends ConflictError {
  constructor(invoiceId: string) {
    super(`Invoice <${invoiceId}> has confirmed payments applied.`, 'The invoice has payments applied; cancel them first.');
  }
}
