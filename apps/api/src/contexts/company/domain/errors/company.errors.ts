import { ConflictError, InvalidArgumentError, NotFoundError } from '../../../../shared/domain/domain.error.js';

export class InvalidCurrencyCodeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A currency code must be three letters, received <${value}>.`, 'The currency code is not valid.');
  }
}

export class UnknownCurrencyError extends InvalidArgumentError {
  constructor(code: string) {
    super(`Currency <${code}> does not exist.`, 'The currency does not exist.');
  }
}

// Una moneda retirada del catalogo no se elige de nuevo; la que ya estaba puesta se conserva.
export class InactiveCurrencyError extends ConflictError {
  constructor(code: string) {
    super(`Currency <${code}> is inactive.`, 'The currency is not active.');
  }
}

export class InvalidTimeZoneError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Unknown time zone <${value}>.`, 'The time zone is not valid.');
  }
}

export class InvalidDecimalPlacesError extends InvalidArgumentError {
  constructor(name: string, value: number, max: number) {
    super(`${name} must be a whole number between 0 and ${max}, received <${value}>.`, 'The number of decimals is out of range.');
  }
}

// Los documentos confirmados llevan sus importes en la moneda de ese momento: cambiarla haria
// que el historico dijera otra cosa.
export class BaseCurrencyLockedError extends ConflictError {
  constructor(tenantId: string) {
    super(
      `Tenant <${tenantId}> has confirmed documents; its base currency is fixed.`,
      'The company currency cannot change once there are confirmed documents.',
    );
  }
}

export class RequiredCompanyTextError extends InvalidArgumentError {
  constructor(name: string) {
    super(`${name} is required.`, 'A required value is empty.');
  }
}

export class CompanyTextTooLongError extends InvalidArgumentError {
  constructor(name: string, max: number) {
    super(`${name} cannot be longer than ${max} characters.`, 'A value is too long.');
  }
}

export class InvalidCompanyEmailError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Invalid company email <${value}>.`, 'The email is not valid.');
  }
}

export class InvalidRateDateError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A rate date must be a calendar day as YYYY-MM-DD, received <${value}>.`, 'The date of the rate is not valid.');
  }
}

export class InvalidRateTypeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A rate type must be legal or manual, received <${value}>.`, 'The type of the rate is not valid.');
  }
}

export class InvalidExchangeRateError extends InvalidArgumentError {
  constructor(value: number, max: number) {
    super(`An exchange rate must be above zero, at most ${max} and with up to eight decimals, received <${value}>.`, 'The exchange rate is not valid.');
  }
}

// El bolivar vale siempre 1 bolivar: una tasa suya no significa nada.
export class LocalCurrencyRateError extends InvalidArgumentError {
  constructor(code: string) {
    super(`Currency <${code}> is the local currency and takes no exchange rate.`, 'The local currency takes no exchange rate.');
  }
}

export class ExchangeRateNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Exchange rate <${id}> not found.`, 'The exchange rate does not exist.');
  }
}

// Sin tasa, un documento en esa moneda no se emite: es preferible a emitirlo con tasa 1.
export class MissingExchangeRateError extends ConflictError {
  constructor(currency: string, type: string, date: string) {
    super(`No active ${type} rate for <${currency}> on or before <${date}>.`, 'There is no exchange rate for that currency on that date.');
  }
}

// Dos cargas simultaneas de la misma moneda, fecha y tipo: la segunda no pisa a ciegas.
export class DuplicateExchangeRateError extends ConflictError {
  constructor(currency: string, type: string, date: string) {
    super(`A ${type} rate for <${currency}> on <${date}> already exists.`, 'That exchange rate was just recorded by someone else.');
  }
}
