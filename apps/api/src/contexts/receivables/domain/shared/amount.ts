import { InvalidPaymentAmountError } from '../errors/receivables.errors.js';

const MAX_CENTS = 9_999_999_999_999_999n;

// Los importes se suman y comparan en centimos enteros: 0,1 + 0,2 no da 0,3 en coma flotante.
export function toBase(value: number): bigint {
  return BigInt(Math.round(value * 10000));
}

export function baseToNumber(base: bigint): number {
  return Number(base) / 10000;
}

// Lo que se cobra: mas de cero y sin fracciones de centimo.
export function paymentBase(value: number): bigint {
  const scaled = Math.round(value * 10000);

  if (!Number.isFinite(value) || value <= 0 || Math.abs(scaled - value * 10000) > 1e-6 || BigInt(scaled) > MAX_CENTS) {
    throw new InvalidPaymentAmountError(value);
  }

  return BigInt(scaled);
}
