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
};

const BY_FIELD: Record<string, string> = {
  amountDecimals: 'Escribe los decimales de los importes como un número entero.',
  priceDecimals: 'Escribe los decimales de los precios como un número entero.',
  legalName: 'Escribe la razón social.',
};

export function readableCompanyError(error: unknown, fallback: string): string {
  if (!(error instanceof AccessError)) return fallback;

  if (BY_CODE[error.code]) return BY_CODE[error.code];

  const field = error.fields.find((candidate) => BY_FIELD[candidate]);

  return field ? BY_FIELD[field] : readableError(error, fallback);
}
