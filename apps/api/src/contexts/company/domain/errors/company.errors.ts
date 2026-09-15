import { ConflictError, InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

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
