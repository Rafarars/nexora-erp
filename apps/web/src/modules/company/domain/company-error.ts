import { AccessError, readableError } from '../../access/domain/access-error';

const BY_CODE: Record<string, string> = {
  InvalidCurrencyCodeError: 'La moneda no es válida.',
  UnknownCurrencyError: 'Esa moneda no existe.',
  InactiveCurrencyError: 'Esa moneda ya no está disponible.',
  InvalidTimeZoneError: 'Elige una zona horaria válida.',
  InvalidDecimalPlacesError: 'Los importes admiten de 0 a 4 decimales y los precios de 0 a 6.',
  BaseCurrencyLockedError: 'La moneda principal no se puede cambiar: la empresa ya tiene documentos confirmados en ella.',
  RequiredCompanyTextError: 'Escribe la razón social.',
  CompanyTextTooLongError: 'Uno de los textos es demasiado largo.',
  InvalidCompanyEmailError: 'El correo no es válido.',
  InvalidRateDateError: 'Elige una fecha válida para la tasa.',
  InvalidRateTypeError: 'Elige si la tasa es legal o interna.',
  InvalidExchangeRateError: 'La tasa tiene que ser mayor que cero, con hasta 8 decimales y menos de 10.000.000.',
  LocalCurrencyRateError: 'El bolívar no lleva tasa: vale siempre 1.',
  ExchangeRateNotFoundError: 'Esa tasa ya no existe.',
  MissingExchangeRateError: 'No hay tasa de cambio cargada para esa moneda en esa fecha ni antes.',
  RateOverrideNotAllowedError: 'La empresa no permite escribir la tasa de un documento: se usa la de Tasas de cambio.',
  FixedExchangeRateError: 'La tasa de la moneda de la empresa y la del bolívar no se escriben a mano.',
  DuplicateExchangeRateError: 'Alguien acaba de cargar esa misma tasa. Vuelve a intentarlo para corregirla.',
};

const BY_FIELD: Record<string, string> = {
  amountDecimals: 'Escribe los decimales de los importes como un número entero.',
  priceDecimals: 'Escribe los decimales de los precios como un número entero.',
  legalName: 'Escribe la razón social.',
  rate: 'Escribe la tasa como un número, por ejemplo 36,50.',
};

export function readableCompanyError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) return fallback;

  if (BY_CODE[error.code]) return BY_CODE[error.code];

  const field = error.fields.find((candidate) => BY_FIELD[candidate]);

  return field ? BY_FIELD[field] : readableError(error, fallback);
}
