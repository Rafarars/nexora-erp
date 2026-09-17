import { InvalidSalesPriceError, InvalidTaxRateSnapshotError } from '../errors/sales.errors.js';
import { roundRatio } from '../../../../shared/domain/amount.js';
import { Quantity } from './quantity.vo.js';

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

// Importes en diezmilesimas, redondeados una sola vez por linea a los decimales de la empresa.
// Cantidad (diezmilesimas) por precio (millonesimas) es el importe por 10^10.
export function lineSubtotalUnits(quantity: Quantity, price: UnitPrice, decimals: number): bigint {
  return roundRatio(quantity.units * price.micros, 1_000_000n, decimals);
}

// Sobre el subtotal ya redondeado: subtotal (diezmilesimas) por porcentaje (diezmilesimas) entre 100.
export function taxUnits(subtotal: bigint, rate: TaxRate, decimals: number): bigint {
  return roundRatio(subtotal * rate.units, 1_000_000n, decimals);
}
