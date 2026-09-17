import { amountUnits, hasAtMostDecimals } from '../../../../shared/domain/amount.js';
import { InvalidPaymentAmountError } from '../errors/receivables.errors.js';

const MAX_UNITS = 99_999_999_999_999_999_999n;

// Lo que se aplica a una factura: mas de cero y sin mas decimales que los de la empresa.
export function paymentUnits(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0 || !hasAtMostDecimals(value, decimals) || amountUnits(value) > MAX_UNITS) {
    throw new InvalidPaymentAmountError(value);
  }

  return amountUnits(value);
}
