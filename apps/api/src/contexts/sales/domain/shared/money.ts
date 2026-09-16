import { InvalidSalesPriceError, InvalidTaxRateSnapshotError } from '../errors/sales.errors.js';
import { Quantity, roundedDivision } from './quantity.vo.js';

const MAX = 999_999_999_999_999_999n;

// Precio por unidad en millonesimas, como entero.
export class UnitPrice {
  private constructor(readonly micros: bigint) {}

  static of(value: number): UnitPrice {
    const scaled = Math.round(value * 1_000_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 1_000_000) > 1e-3 || BigInt(scaled) > MAX) {
      throw new InvalidSalesPriceError(value);
    }

    return new UnitPrice(BigInt(scaled));
  }

  static ofMicros(micros: bigint): UnitPrice {
    return new UnitPrice(micros);
  }

  toNumber(): number {
    return Number(this.micros) / 1_000_000;
  }
}

// El porcentaje del impuesto en diezmilesimas, copiado del catalogo cuando se escribe la
// linea: si luego el IVA cambia, el pedido sigue diciendo lo que se pacto.
export class TaxRate {
  private constructor(readonly units: bigint) {}

  static of(value: number): TaxRate {
    const scaled = Math.round(value * 10_000);

    if (!Number.isFinite(value) || value < 0 || value > 100 || Math.abs(scaled - value * 10_000) > 1e-6) {
      throw new InvalidTaxRateSnapshotError(value);
    }

    return new TaxRate(BigInt(scaled));
  }

  toNumber(): number {
    return Number(this.units) / 10_000;
  }
}

// Importes base en diezmilesimas (4 decimales de precision interna). 
// Cantidad (10^4) por precio (10^6) = 10^10. Para llevar a 10^4 dividimos por 10^6.
export function lineSubtotalBase(quantity: Quantity, price: UnitPrice): bigint {
  return roundedDivision(quantity.units * price.micros, 1_000_000n);
}

export function taxBase(subtotalBase: bigint, rate: TaxRate): bigint {
  return roundedDivision(subtotalBase * rate.units, 10_000n);
}

export function baseToNumber(base: bigint): number {
  return Number(base) / 10_000;
}

// Redondea un importe base a los decimales de la empresa (ej. 2) 
// devolviendo un number para la persistencia.
export function roundedAmount(base: bigint, decimals: number): number {
  const factor = 10 ** (4 - decimals);
  const roundedBase = roundedDivision(base, BigInt(factor)) * BigInt(factor);
  return Number(roundedBase) / 10_000;
}
