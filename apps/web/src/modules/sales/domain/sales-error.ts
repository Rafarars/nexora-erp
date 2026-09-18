import { AccessError } from '../../access/domain/access-error';
import { readablePurchasingError } from '../../purchasing/domain/purchasing-error';

const BY_CODE: Record<string, string> = {
  CustomerNotFoundError: 'Ese cliente ya no existe en esta empresa.',
  SalesOrderNotFoundError: 'Ese pedido ya no existe en esta empresa.',
  DispatchNotFoundError: 'Ese despacho ya no existe en esta empresa.',
  InvoiceNotFoundError: 'Esa factura ya no existe en esta empresa.',
  SalesItemNotFoundError: 'Uno de los artículos ya no existe en esta empresa.',
  SalesWarehouseNotFoundError: 'La bodega ya no existe en esta empresa.',
  DuplicateCustomerNameError: 'Ya existe un cliente con ese nombre.',
  InvalidCustomerEmailError: 'El correo del cliente no es válido.',
  InvalidPaymentTermError: 'El plazo de pago debe ser un número entero de días, de 0 a 365.',
  InvalidCreditLimitError: 'El límite de crédito debe ser un monto de cero o más, con hasta dos decimales.',
  InactiveCustomerError: 'El cliente está inactivo: no se le pueden hacer pedidos.',
  InactiveSalesItemError: 'El documento usa un artículo inactivo.',
  SalesItemChangedError: 'La unidad de un artículo cambió desde que se escribió el pedido: revisa las cantidades y guárdalo antes de confirmar.',
  InactiveSalesWarehouseError: 'El documento usa una bodega inactiva.',
  MissingSalesPriceError: 'Ese artículo no tiene precio en la lista elegida: escríbelo.',
  SalesPriceBelowMinimumError: 'El precio está por debajo del mínimo permitido para ese artículo.',
  PriceListNotFoundError: 'Esa lista de precio ya no existe.',
  InactivePriceListError: 'Esa lista de precio está desactivada.',
  ServiceNotSellableError: 'Un servicio no sale de una bodega: no se puede pedir.',
  ItemNotSellableError: 'Ese artículo no está marcado para venderse: revísalo en Inventario › Artículos.',
  SalesUnitNotOfItemError: 'Una línea usa una unidad que el artículo no tiene.',
  InvalidSalesQuantityError: 'Cada cantidad debe ser mayor que cero, con hasta cuatro decimales.',
  InvalidSalesPriceError: 'El precio debe ser cero o más, con hasta seis decimales.',
  InvalidTaxRateSnapshotError: 'El impuesto de un artículo no es válido.',
  SalesTextTooLongError: 'Uno de los textos es demasiado largo.',
  EmptySalesTextError: 'Falta un dato obligatorio.',
  InvalidSalesDateError: 'La fecha no es válida.',
  FutureSalesDateError: 'Un documento de venta no puede tener fecha futura.',
  EmptySalesOrderError: 'Agrega al menos una línea al pedido.',
  SalesOrderNotEditableError: 'Solo se puede editar un pedido en borrador.',
  SalesOrderNotConfirmableError: 'Solo se puede confirmar un pedido en borrador.',
  SalesOrderNotCancellableError: 'Este pedido ya no se puede anular.',
  SalesOrderWithDispatchesError: 'El pedido ya tiene mercancía despachada: anula primero sus despachos.',
  SalesOrderNotDispatchableError: 'Solo se despacha de un pedido confirmado que tenga algo pendiente.',
  InsufficientAvailabilityError: 'No hay existencia disponible suficiente para reservar este pedido.',
  DispatchExceedsPendingError: 'El despacho lleva más de lo que queda pendiente en el pedido.',
  EmptyDispatchError: 'Indica cuánto sale de al menos una línea.',
  DispatchLineNotInOrderError: 'Una línea del despacho no pertenece a su pedido.',
  DuplicateDispatchLineError: 'Cada línea del pedido puede aparecer una sola vez en el despacho.',
  DispatchNotEditableError: 'Solo se puede editar un despacho en borrador.',
  DispatchNotConfirmableError: 'Solo se puede confirmar un despacho en borrador.',
  DispatchAlreadyCancelledError: 'El despacho ya está anulado.',
  InsufficientStockForDispatchError: 'La bodega ya no tiene la existencia de este despacho.',
  DispatchInvoicedError: 'El despacho está facturado: anula primero su factura.',
  DispatchNotInvoiceableError: 'Solo se factura un despacho confirmado.',
  DispatchAlreadyInvoicedError: 'Este despacho ya tiene una factura emitida.',
  InvoiceAlreadyCancelledError: 'La factura ya está anulada.',
  CustomerWithOverdueInvoicesError: 'El cliente tiene facturas vencidas: no se le puede facturar a crédito hasta que pague.',
  CreditLimitExceededError: 'La factura supera el límite de crédito del cliente.',
  InvoiceWithPaymentsError: 'La factura tiene cobros aplicados: anula primero esos cobros.',
};

// Los mensajes de ventas y, para lo demas, los de compras, inventario, catalogo y acceso.
export function readableSalesError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('lines'))) {
      return 'Revisa las líneas: cada una necesita una cantidad numérica y, en un pedido, artículo, unidad y precio.';
    }
  }

  return readablePurchasingError(error, fallback);
}
