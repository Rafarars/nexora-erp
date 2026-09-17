import { InvalidPurchaseCostError, InvalidTaxRateSnapshotError } from '../errors/purchasing.errors.js';
import { roundRatio } from '../../../../shared/domain/amount.js';
import { Quantity, roundedDivision } from './quantity.vo.js';

const MAX = 999_999_999_999_999_999n;

// Costo por unidad en millonesimas, como entero.
export class UnitCost {
  private constructor(readonly micros: bigint) {}

  static of(value: number): UnitCost {
    const scaled = Math.round(value * 1_000_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 1_000_000) > 1e-3 || BigInt(scaled) > MAX) {
      throw new InvalidPurchaseCostError(value);
    }

    return new UnitCost(BigInt(scaled));
  }

  static ofMicros(micros: bigint): UnitCost {
    return new UnitCost(micros);
  }

  // Cuanto cuesta cada unidad base si `quantity` unidades de la linea cuestan esto cada una
  // y equivalen a `base` unidades base. Una caja de 24 a 12 es 0,5 por unidad.
  perBase(quantity: Quantity, base: Quantity): UnitCost {
    return new UnitCost(roundedDivision(this.micros * quantity.units, base.units));
  }

  toNumber(): number {
    return Number(this.micros) / 1_000_000;
  }
}

// El porcentaje del impuesto en diezmilesimas, copiado del catalogo cuando se escribe la
// linea: si luego el IVA cambia, la orden sigue diciendo lo que se pacto.
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

// Importes en diezmilesimas, redondeados una sola vez por linea a los decimales de la empresa, como
// en ventas. Cantidad (diezmilesimas) por costo (millonesimas) es el importe por 10^10.
export function lineSubtotalUnits(quantity: Quantity, cost: UnitCost, decimals: number): bigint {
  return roundRatio(quantity.units * cost.micros, 1_000_000n, decimals);
}

// Sobre el subtotal ya redondeado: subtotal (diezmilesimas) por porcentaje (diezmilesimas) entre 100.
export function taxUnits(subtotal: bigint, rate: TaxRate, decimals: number): bigint {
  return roundRatio(subtotal * rate.units, 1_000_000n, decimals);
}
