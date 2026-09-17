import { roundRatio, roundedDivision } from './amount.js';
import { DocumentRateSet } from './ports/document-rates.js';

export interface DocumentCurrencyPrimitives {
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;
}

// Las tasas se guardan con ocho decimales.
const RATE_SCALE = 100_000_000n;

export const rateUnits = (rate: number): bigint => BigInt(Math.round(rate * 100_000_000));

// La moneda de un documento y las dos tasas que congelo: bolivares por 1 unidad de su moneda y por 1
// unidad de la moneda de la empresa. Un documento anterior al multimoneda no tiene tasas: se
// escribio en la moneda de la empresa. La comparten compras, ventas y cobranza.
export class DocumentCurrency {
  private constructor(
    readonly currency: string,
    readonly exchangeRate: number | null,
    readonly baseCurrency: string,
    readonly baseExchangeRate: number | null,
    readonly manual: boolean,
  ) {}

  static of(rates: DocumentRateSet): DocumentCurrency {
    return new DocumentCurrency(rates.currency, rates.exchangeRate, rates.baseCurrency, rates.baseExchangeRate, rates.manualRate);
  }

  static fromPrimitives(row: DocumentCurrencyPrimitives): DocumentCurrency {
    return new DocumentCurrency(row.currency, row.exchangeRate, row.baseCurrency, row.baseExchangeRate, row.manualExchangeRate);
  }

  toPrimitives(): DocumentCurrencyPrimitives {
    return {
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      baseCurrency: this.baseCurrency,
      baseExchangeRate: this.baseExchangeRate,
      manualExchangeRate: this.manual,
    };
  }

  // La tasa que escribio una persona, para pedirla otra vez al revalidar el borrador.
  manualRate(): number | null {
    return this.manual ? this.exchangeRate : null;
  }

  private convertsToBase(): boolean {
    return this.currency !== this.baseCurrency && this.exchangeRate !== null && this.baseExchangeRate !== null;
  }

  // Un valor de la moneda del documento en la moneda de la empresa, por el bolivar y con la misma
  // escala (un costo en millonesimas sigue en millonesimas).
  toBase(value: bigint): bigint {
    if (!this.convertsToBase()) return value;

    return roundedDivision(value * rateUnits(this.exchangeRate!), rateUnits(this.baseExchangeRate!));
  }

  // Un importe (diezmilesimas) en la moneda de la empresa, redondeado a sus decimales.
  baseAmount(units: bigint, decimals: number): bigint {
    if (!this.convertsToBase()) return units;

    return roundRatio(units * rateUnits(this.exchangeRate!), rateUnits(this.baseExchangeRate!), decimals);
  }

  // Un importe (diezmilesimas) en bolivares, redondeado a los decimales de la empresa; null sin tasa.
  bolivars(units: bigint, decimals: number): bigint | null {
    if (this.currency === 'VES') return units;
    if (this.exchangeRate === null) return null;

    return roundRatio(units * rateUnits(this.exchangeRate), RATE_SCALE, decimals);
  }
}
