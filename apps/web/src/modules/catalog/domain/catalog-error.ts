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
  CategoryInUseError: 'No se puede desactivar: hay artículos activos en esta categoría.',
  MeasurementUnitInUseError: 'No se puede desactivar: hay artículos activos que usan esta unidad.',
  TaxInUseError: 'No se puede desactivar: hay artículos activos con este impuesto.',
  DefaultWarehouseDeactivationError: 'No se puede desactivar la bodega por defecto. Elige otra por defecto primero.',
  InactiveDefaultWarehouseError: 'Una bodega inactiva no puede ser la bodega por defecto.',
  ConcurrentDefaultWarehouseError: 'Otra persona cambió la bodega por defecto al mismo tiempo. Vuelve a intentarlo.',
  DuplicatePriceListNameError: 'Ya existe una lista de precio con ese nombre.',
  DefaultPriceListDeactivationError: 'No se puede desactivar la lista de precio por defecto. Elige otra por defecto primero.',
  InactiveDefaultPriceListError: 'Una lista inactiva no puede ser la lista por defecto.',
  ConcurrentDefaultPriceListError: 'Otra persona cambió la lista por defecto al mismo tiempo. Vuelve a intentarlo.',
  UnknownPriceListCurrencyError: 'Esa moneda no está disponible.',
  InvalidTaxRateError: 'El porcentaje debe estar entre 0 y 100, con hasta cuatro decimales.',
  InvalidAbbreviationError: 'La abreviatura no puede tener espacios.',
  TextTooLongError: 'Uno de los textos es demasiado largo.',
};

const BY_FIELD: Record<string, string> = {
  name: 'Escribe un nombre.',
  abbreviation: 'Escribe una abreviatura.',
  rate: 'Escribe el porcentaje como un número entre 0 y 100.',
};

export function readableCatalogError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) {
    return fallback;
  }

  if (BY_CODE[error.code]) {
    return BY_CODE[error.code];
  }

  const field = error.fields.find((candidate) => BY_FIELD[candidate]);

  if (field) {
    return BY_FIELD[field];
  }

  return readableError(error, fallback);
}
