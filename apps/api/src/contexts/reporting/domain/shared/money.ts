import { amountUnits, roundRatio, unitsToNumber } from '../../../../shared/domain/amount.js';

export { amountUnits, unitsToNumber };

// Importes en diezmilesimas enteras: sumar miles de facturas en coma flotante deja restos. Lo que
// llega del modelo de lectura ya viene en la moneda de la empresa y redondeado a sus decimales.
export function sumAmounts(values: number[]): number {
  return unitsToNumber(values.reduce((sum, value) => sum + amountUnits(value), 0n));
}

// Existencia (cuatro decimales) por costo promedio (seis), redondeado por fila a los decimales de la
// empresa. El costo promedio ya esta en la moneda de la empresa: el inventario lo convierte al recibir.
export function stockValueUnits(quantity: number, averageCost: number, decimals: number): bigint {
  return roundRatio(amountUnits(quantity) * BigInt(Math.round(averageCost * 1_000_000)), 1_000_000n, decimals);
}
