// Importes en centimos enteros: sumar miles de facturas en coma flotante deja restos.
export function toCents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}

export function sumCents(values: number[]): number {
  return centsToNumber(values.reduce((sum, value) => sum + toCents(value), 0n));
}
