import { InvalidPaymentAmountError } from '../errors/receivables.errors.js';

const MAX_CENTS = 9_999_999_999_999_999n;

// Los importes se suman y comparan en centimos enteros: 0,1 + 0,2 no da 0,3 en coma flotante.
export function toCents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}

// Lo que se cobra: mas de cero y sin fracciones de centimo.
export function paymentCents(value: number): bigint {
  const scaled = Math.round(value * 100);

  if (!Number.isFinite(value) || value <= 0 || Math.abs(scaled - value * 100) > 1e-6 || BigInt(scaled) > MAX_CENTS) {
    throw new InvalidPaymentAmountError(value);
  }

  return BigInt(scaled);
}
