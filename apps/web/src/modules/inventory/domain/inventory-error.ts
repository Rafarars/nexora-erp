import { readableCatalogError } from '../../catalog/domain/catalog-error';
import { AccessError } from '../../access/domain/access-error';

const BY_CODE: Record<string, string> = {
  // El maestro de articulos.
  DuplicateSkuError: 'Ya existe un artículo con ese SKU.',
  DuplicateBarcodeError: 'Ya existe un artículo con ese código de barras.',
  InvalidBarcodeError: 'El código de barras solo admite letras, dígitos, puntos, guiones y guiones bajos.',
  InactiveReferenceError: 'El artículo usa una categoría, un impuesto o una unidad que están inactivos.',
  ItemInOpenDocumentsError:
    'El artículo está en órdenes de compra o pedidos de venta abiertos: recíbelos, despáchalos o anúlalos primero.',
  ItemUnitInOpenDocumentsError:
    'Una orden de compra o un pedido de venta abierto usa esa unidad: no se puede quitar ni cambiar su factor hasta cerrarlo.',
  InvalidConversionFactorError: 'Cada factor de conversión debe ser un número mayor que cero.',
  InvalidSkuError: 'El SKU solo admite letras, números, puntos, guiones y guiones bajos.',
  InvalidItemUnitsError: 'El artículo necesita exactamente una unidad base y ninguna unidad repetida.',
  InvalidItemTypeError: 'Elige un tipo de artículo válido.',
  InventoryTextTooLongError: 'Uno de los textos es demasiado largo.',
  // Existencias, kardex y ajustes.
  InsufficientStockError: 'No hay existencia suficiente para esta salida.',
  AdjustmentNotFoundError: 'Ese ajuste ya no existe en esta empresa.',
  AdjustmentNotEditableError: 'Solo se puede editar un ajuste en borrador.',
  AdjustmentNotConfirmableError: 'Solo se puede confirmar un ajuste en borrador.',
  AdjustmentAlreadyCancelledError: 'El ajuste ya está anulado.',
  EmptyAdjustmentError: 'Agrega al menos una línea al ajuste.',
  ServiceHasNoStockError: 'Un servicio no tiene existencia: no se puede ajustar.',
  UnitNotOfItemError: 'Una línea usa una unidad que el artículo no tiene.',
  InvalidQuantityError: 'Cada cantidad debe ser mayor que cero, con hasta cuatro decimales.',
  InvalidUnitCostError: 'El costo debe ser cero o más, con hasta seis decimales.',
  CostOnOutgoingLineError: 'Solo las entradas llevan costo: las salidas se valoran al costo promedio.',
  InvalidAdjustmentDateError: 'La fecha no es válida.',
  FutureAdjustmentDateError: 'Un ajuste no puede tener fecha futura.',
  InvalidDirectionError: 'Cada línea debe ser una entrada o una salida.',
  InactiveStockItemError: 'El ajuste usa un artículo inactivo.',
  StockItemChangedError: 'La unidad de un artículo cambió desde que se escribió el ajuste: revisa las cantidades y guárdalo antes de confirmar.',
  InactiveStockWarehouseError: 'El ajuste usa una bodega inactiva.',
  StockItemNotFoundError: 'Uno de los artículos ya no existe en esta empresa.',
  StockWarehouseNotFoundError: 'La bodega ya no existe en esta empresa.',
  ItemWithStockError: 'El artículo todavía tiene existencia: no se puede desactivar.',
  WarehouseWithStockError: 'La bodega todavía tiene existencia: no se puede desactivar.',
  ItemWithMovementsError: 'El artículo ya tiene movimientos: su unidad base y su tipo no pueden cambiar.',
};

const BY_FIELD: Record<string, string> = {
  sku: 'Escribe un SKU.',
  type: 'Elige un tipo de artículo.',
};

// Los mensajes del inventario y, para lo demas, los del catalogo y el acceso.
export function readableInventoryError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    // Las unidades llegan como `units.1.conversionFactor`: una persona corrige la fila,
    // no la ruta del JSON.
    if (error.fields.some((field) => field === 'units' || field.startsWith('units.'))) {
      return 'Revisa las unidades del artículo: cada una necesita un factor numérico mayor que cero.';
    }

    const field = error.fields.find((candidate) => BY_FIELD[candidate]);

    if (field) return BY_FIELD[field];

    if (error.fields.some((field) => field.startsWith('lines'))) {
      return 'Revisa las líneas: cada una necesita artículo, unidad, tipo y una cantidad numérica.';
    }
  }

  return readableCatalogError(error, fallback);
}
