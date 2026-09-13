import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

export class InvalidTaxRateError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A tax rate must be between 0 and 100 with at most four decimals, received <${value}>.`,
      'The tax rate must be between 0 and 100.',
    );
  }
}

export class InvalidConversionFactorError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A conversion factor must be positive with at most four decimals, received <${value}>.`,
      'A conversion factor must be a positive number.',
    );
  }
}

export class InvalidSkuError extends InvalidArgumentError {
  constructor(value: string) {
    super(
      `A SKU may only contain letters, digits, dots, dashes and underscores, received <${value}>.`,
      'The SKU contains characters that are not allowed.',
    );
  }
}

export class InvalidItemTypeError extends InvalidArgumentError {
  constructor(value: string) {
    super(`Unknown item type <${value}>.`, 'The item type is not valid.');
  }
}

// Las reglas de las unidades de un articulo tienen cada una su motivo, y el mensaje
// interno lo dice; hacia fuera basta con senalar que las unidades no cuadran.
export class InvalidItemUnitsError extends InvalidArgumentError {
  constructor(reason: string) {
    super(`Invalid item units: ${reason}`, 'The units of the item are not valid.');
  }
}
