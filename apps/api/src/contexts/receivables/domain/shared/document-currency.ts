import { DocumentRateSet } from '../../../../shared/domain/ports/document-rates.js';

export interface DocumentCurrencyPrimitives {
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;
}

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

  manualRate(): number | null {
    return this.manual ? this.exchangeRate : null;
  }
}
