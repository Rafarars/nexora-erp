import { readableCatalogError } from '../../catalog/domain/catalog-error';
import { AccessError } from '../../access/domain/access-error';

const BY_CODE: Record<string, string> = {
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

// Los mensajes del inventario y, para lo demas, los del catalogo y el acceso.
export function readableInventoryError(error: unknown, fallback: string): string {
  if (error instanceof AccessError) {
    if (BY_CODE[error.code]) return BY_CODE[error.code];

    if (error.fields.some((field) => field.startsWith('lines'))) {
      return 'Revisa las líneas: cada una necesita artículo, unidad, tipo y una cantidad numérica.';
    }
  }

  return readableCatalogError(error, fallback);
}
