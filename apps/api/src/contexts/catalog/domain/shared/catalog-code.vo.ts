import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { StringValueObject } from '../../../../shared/domain/value-object.js';

const CODE_PATTERN = /^[A-Z]{3}\d{6,}$/;

// ART ya no: el articulo vive en el inventario, con su propio codigo.
export type CodePrefix = 'CAT' | 'UOM' | 'IMP' | 'BOD' | 'LPR';

export class InvalidCatalogCodeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`A catalog code must be three letters and six digits, received <${value}>.`);
  }
}

// El correlativo legible que ve una persona (`CAT000001`), distinto del UUID. Lo
// genera el sistema; nadie lo escribe.
export class CatalogCode extends StringValueObject {
  private constructor(value: string) {
    super(value);

    if (!CODE_PATTERN.test(value)) {
      throw new InvalidCatalogCodeError(value);
    }
  }

  static of(value: string): CatalogCode {
    return new CatalogCode(value);
  }

  static fromSequence(prefix: CodePrefix, sequence: number): CatalogCode {
    return new CatalogCode(`${prefix}${String(sequence).padStart(6, '0')}`);
  }
}
