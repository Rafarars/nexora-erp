import { StringValueObject } from '../../../../shared/domain/value-object.js';
import { InvalidPriceListCurrencyError } from '../errors/price-list.errors.js';

const CODE_PATTERN = /^[A-Z]{3}$/;

// Codigo ISO 4217: USD, EUR, VES. El catalogo lo guarda en mayusculas, como la empresa.
export class CurrencyCode extends StringValueObject {
  private constructor(value: string) {
    super(value.trim().toUpperCase());

    if (!CODE_PATTERN.test(this.value)) throw new InvalidPriceListCurrencyError(value);
  }

  static of(value: string): CurrencyCode {
    return new CurrencyCode(value);
  }
}
