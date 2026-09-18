import { InvalidItemPriceError } from '../errors/item.errors.js';

const MAX_MICROS = 999_999_999_999_999_999n;

// Precio en millonesimas, entero por la misma razon que el costo: seis decimales exactos sin
// coma flotante.
export class SalePrice {
  private constructor(readonly micros: bigint) {}

  static of(value: number): SalePrice {
    const scaled = Math.round(value * 1_000_000);

    if (!Number.isFinite(value) || value < 0 || Math.abs(scaled - value * 1_000_000) > 1e-3) {
      throw new InvalidItemPriceError(`<${value}> must be zero or more, with at most six decimals.`);
    }

    if (BigInt(scaled) > MAX_MICROS) throw new InvalidItemPriceError(`<${value}> is too large.`);

    return new SalePrice(BigInt(scaled));
  }

  isLowerThan(other: SalePrice): boolean {
    return this.micros < other.micros;
  }

  toNumber(): number {
    return Number(this.micros) / 1_000_000;
  }
}
