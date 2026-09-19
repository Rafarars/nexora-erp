import { AccessError } from '../../access/domain/access-error';
import { readableInventoryError } from '../../inventory/domain/inventory-error';

const BY_CODE: Record<string, string> = {
  SupplierNotFoundError: 'Ese proveedor ya no existe en esta empresa.',
  PurchaseOrderNotFoundError: 'Esa orden de compra ya no existe en esta empresa.',
  GoodsReceiptNotFoundError: 'Esa entrada de mercancía ya no existe en esta empresa.',
  PurchaseItemNotFoundError: 'Uno de los artículos ya no existe en esta empresa.',
  PurchaseWarehouseNotFoundError: 'La bodega ya no existe en esta empresa.',
  DuplicateSupplierNameError: 'Ya existe un proveedor con ese nombre.',
  InvalidSupplierEmailError: 'El correo del proveedor no es válido.',
  InvalidPaymentTermError: 'El plazo de pago debe ser un número entero de días, de 0 a 365.',
  InactiveSupplierError: 'El proveedor está inactivo: no se le pueden hacer órdenes.',
  InactivePurchaseItemError: 'La orden o la entrada usa un artículo inactivo.',
  PurchaseItemChangedError:
    'La unidad de un artículo cambió desde que se escribió la orden: revisa las cantidades y guárdala antes de confirmar.',
  InactivePurchaseWarehouseError: 'La orden o la entrada usa una bodega inactiva.',
  ServiceNotPurchasableError: 'Un servicio no se recibe en una bodega: no se puede pedir en una orden.',
  ServiceNotReceivableError: 'Un servicio no entra a una bodega: se paga con la factura del proveedor, sin entrada de mercancía.',
  PurchaseUnitNotOfItemError: 'Una línea usa una unidad que el artículo no tiene.',
  InvalidPurchaseQuantityError: 'Cada cantidad debe ser mayor que cero, con hasta cuatro decimales.',
  InvalidPurchaseCostError: 'El costo debe ser cero o más, con hasta seis decimales.',
  InvalidTaxRateSnapshotError: 'El impuesto de un artículo no es válido.',
  PurchasingTextTooLongError: 'Uno de los textos es demasiado largo.',
  EmptyPurchasingTextError: 'Falta un dato obligatorio.',
  InvalidPurchaseDateError: 'La fecha no es válida.',
  FuturePurchaseDateError: 'Una orden o una entrada no puede tener fecha futura.',
  ExpectedDateBeforeOrderError: 'La fecha esperada no puede ser anterior a la de la orden.',
  EmptyPurchaseOrderError: 'Agrega al menos una línea a la orden.',
  PurchaseOrderNotEditableError: 'Solo se puede editar una orden en borrador.',
  PurchaseOrderNotConfirmableError: 'Solo se puede confirmar una orden en borrador.',
  PurchaseOrderNotCancellableError: 'Esta orden ya no se puede anular.',
  PurchaseOrderWithReceiptsError: 'La orden ya recibió mercancía: anula primero sus entradas.',
  PurchaseOrderNotReceivableError: 'Solo se recibe mercancía de una orden confirmada que tenga algo pendiente.',
  ReceiptExceedsPendingError: 'La entrada trae más de lo que queda pendiente en la orden.',
  EmptyGoodsReceiptError: 'Indica cuánto llegó de al menos una línea.',
  ReceiptLineNotInOrderError: 'Una línea de la entrada no pertenece a su orden.',
  DuplicateReceiptLineError: 'Cada línea de la orden puede aparecer una sola vez en la entrada.',
  GoodsReceiptNotEditableError: 'Solo se puede editar una entrada en borrador.',
  GoodsReceiptNotConfirmableError: 'Solo se puede confirmar una entrada en borrador.',
  GoodsReceiptAlreadyCancelledError: 'La entrada ya está anulada.',
  MissingExchangeRateError:
    'No hay tasa de cambio cargada en esa fecha ni antes para la moneda del documento o la de la empresa: cárgala en Administración › Tasas de cambio.',
  RateOverrideNotAllowedError: 'La empresa no permite escribir la tasa: deja el campo vacío y se usa la del día.',
  FixedExchangeRateError: 'La tasa de la moneda de la empresa y la del bolívar no se escriben a mano.',
  ItemNotPurchasableError: 'Ese artículo no está marcado para comprarse: revísalo en Inventario › Artículos.',
  PriceDecimalsExceededError:
    'Un precio o costo tiene más decimales de los que usa la empresa: revisa los parámetros en Administración › Empresa.',
  InvalidExchangeRateError: 'La tasa tiene que ser mayor que cero, con hasta 8 decimales.',
  UnknownCurrencyError: 'Esa moneda no existe.',
  InactiveCurrencyError: 'Esa moneda ya no está disponible: elige otra.',
  InvalidCurrencyCodeError: 'La moneda no es válida.',
  ReceivedGoodsAlreadyUsedError: 'Parte de la mercancía de esta entrada ya salió de la bodega: no se puede anular.',
};

// Los mensajes de compras y, para lo demas, los del inventario, el catalogo y el acceso.
export function readablePurchasingError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('lines'))) {
      return 'Revisa las líneas: cada una necesita una cantidad numérica y, en una orden, artículo, unidad y costo.';
    }

    if (error.fields.includes('paymentTermDays')) return 'El plazo de pago debe ser un número de días.';
    if (error.fields.includes('exchangeRate')) return 'Escribe la tasa como un número, por ejemplo 36,50, o déjala vacía.';
  }

  return readableInventoryError(error, fallback);
}
