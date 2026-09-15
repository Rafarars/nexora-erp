import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

export class InvalidTaxRateError extends InvalidArgumentError {
  constructor(value: number) {
    super(
      `A tax rate must be between 0 and 100 with at most four decimals, received <${value}>.`,
      'The tax rate must be between 0 and 100.',
    );
  }
}
