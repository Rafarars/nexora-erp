import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';
import { UnitCost } from './money.js';
import { roundedDivision } from './quantity.vo.js';

export interface DocumentCurrencyPrimitives {
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;
}

// Las tasas se guardan con ocho decimales.
const rateUnits = (rate: number) => BigInt(Math.round(rate * 100_000_000));

// La moneda de un documento y las dos tasas que congelo: bolivares por 1 unidad de su moneda y por 1
// unidad de la moneda de la empresa. Un documento anterior al multimoneda no tiene tasas: se
// escribio en la moneda de la empresa.
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

  // Un costo en la moneda del documento, llevado a la moneda de la empresa por el bolivar: el
  // inventario se valora en la moneda de la empresa.
  toBase(cost: UnitCost): UnitCost {
    if (this.currency === this.baseCurrency || this.exchangeRate === null || this.baseExchangeRate === null) return cost;

    return UnitCost.ofMicros(roundedDivision(cost.micros * rateUnits(this.exchangeRate), rateUnits(this.baseExchangeRate)));
  }
}
