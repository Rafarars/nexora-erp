// Los importes se calculan en diezmilesimas enteras, el maximo de decimales que admite una empresa,
// y se redondean una sola vez a los decimales de la empresa: 0,1 + 0,2 no da 0,3 en coma flotante.
export const AMOUNT_SCALE = 10_000n;

export const amountUnits = (value: number): bigint => BigInt(Math.round(value * 10_000));

export const unitsToNumber = (units: bigint): number => Number(units) / 10_000;

// Division entera redondeada a la mitad, alejandose de cero tambien en negativos.
export function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (2n * d);

  return negative ? -quotient : quotient;
}

// `numerator / denominator` es un importe en diezmilesimas: se redondea a `decimals` y sigue en
// diezmilesimas.
export function roundRatio(numerator: bigint, denominator: bigint, decimals: number): bigint {
  const step = 10n ** BigInt(4 - decimals);

  return roundedDivision(numerator, denominator * step) * step;
}

// Un importe escrito por una persona no trae mas decimales que los de la empresa.
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;

  return Math.abs(Math.round(scaled) - scaled) < 1e-6;
}
