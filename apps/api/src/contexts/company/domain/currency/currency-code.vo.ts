import { StringValueObject } from '../../../../shared/domain/value-object.js';
import { InvalidCurrencyCodeError } from '../errors/company.errors.js';

const CODE_PATTERN = /^[A-Z]{3}$/;

// Codigo ISO 4217: USD, EUR, VES. Se guarda en mayusculas.
export class CurrencyCode extends StringValueObject {
  private constructor(value: string) {
    super(value.trim().toUpperCase());

    if (!CODE_PATTERN.test(this.value)) throw new InvalidCurrencyCodeError(value);
  }

  static of(value: string): CurrencyCode {
    return new CurrencyCode(value);
  }
}
