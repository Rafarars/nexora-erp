import { AccessError, readableError } from '../../access/domain/access-error';

// Los fallos de la API llegan con la misma forma en todos los modulos: AccessError es
// en realidad el error de la API. Aqui se anaden los codigos del catalogo, siempre en
// espanol y sin el texto tecnico que devuelve la API.
const BY_CODE: Record<string, string> = {
  DuplicateCategoryNameError: 'Ya existe una categoría con ese nombre.',
  DuplicateMeasurementUnitNameError: 'Ya existe una unidad con ese nombre.',
  DuplicateMeasurementUnitAbbreviationError: 'Ya existe una unidad con esa abreviatura.',
  DuplicateTaxNameError: 'Ya existe un impuesto con ese nombre.',
  DuplicateWarehouseNameError: 'Ya existe una bodega con ese nombre.',
  DuplicateSkuError: 'Ya existe un artículo con ese SKU.',
  CategoryInUseError: 'No se puede desactivar: hay artículos activos en esta categoría.',
  MeasurementUnitInUseError: 'No se puede desactivar: hay artículos activos que usan esta unidad.',
  TaxInUseError: 'No se puede desactivar: hay artículos activos con este impuesto.',
  DefaultWarehouseDeactivationError: 'No se puede desactivar la bodega por defecto. Elige otra por defecto primero.',
  InactiveDefaultWarehouseError: 'Una bodega inactiva no puede ser la bodega por defecto.',
  ConcurrentDefaultWarehouseError: 'Otra persona cambió la bodega por defecto al mismo tiempo. Vuelve a intentarlo.',
  InactiveReferenceError: 'El artículo usa una categoría, un impuesto o una unidad que están inactivos.',
  ItemWithStockError: 'El artículo todavía tiene existencia: no se puede desactivar.',
  ItemWithMovementsError: 'El artículo ya tiene movimientos: su unidad base y su tipo no pueden cambiar.',
  ItemInOpenDocumentsError:
    'El artículo está en órdenes de compra o pedidos de venta abiertos: recíbelos, despáchalos o anúlalos primero.',
  ItemUnitInOpenDocumentsError:
    'Una orden de compra o un pedido de venta abierto usa esa unidad: no se puede quitar ni cambiar su factor hasta cerrarlo.',
  InvalidTaxRateError: 'El porcentaje debe estar entre 0 y 100, con hasta cuatro decimales.',
  InvalidConversionFactorError: 'Cada factor de conversión debe ser un número mayor que cero.',
  InvalidSkuError: 'El SKU solo admite letras, números, puntos, guiones y guiones bajos.',
  InvalidItemUnitsError: 'El artículo necesita exactamente una unidad base y ninguna unidad repetida.',
  InvalidAbbreviationError: 'La abreviatura no puede tener espacios.',
  InvalidItemTypeError: 'Elige un tipo de artículo válido.',
  TextTooLongError: 'Uno de los textos es demasiado largo.',
};

const BY_FIELD: Record<string, string> = {
  name: 'Escribe un nombre.',
  abbreviation: 'Escribe una abreviatura.',
  rate: 'Escribe el porcentaje como un número entre 0 y 100.',
  sku: 'Escribe un SKU.',
  type: 'Elige un tipo de artículo.',
};

export function readableCatalogError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) {
    return fallback;
  }

  if (BY_CODE[error.code]) {
    return BY_CODE[error.code];
  }

  // Las unidades llegan como `units.1.conversionFactor`: una persona corrige la fila,
  // no la ruta del JSON.
  if (error.fields.some((field) => field === 'units' || field.startsWith('units.'))) {
    return 'Revisa las unidades del artículo: cada una necesita un factor numérico mayor que cero.';
  }

  const field = error.fields.find((candidate) => BY_FIELD[candidate]);

  if (field) {
    return BY_FIELD[field];
  }

  return readableError(error, fallback);
}
