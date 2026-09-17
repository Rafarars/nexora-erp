import {
  DocumentRateRequest,
  DocumentRateSet,
  DocumentRates,
  FixedExchangeRateError,
  MissingExchangeRateError,
  RateOverrideNotAllowedError,
} from '../../domain/ports/document-rates.js';

interface RateSince {
  currency: string;
  from: string;
  rate: number;
}

// Las tasas de juguete de los contextos que emiten documentos: la empresa lleva sus cifras en
// dolares, deja escribir la tasa y tiene dolar y euro desde siempre. Una prueba cambia lo que
// necesite: otra tasa desde un dia, quitar una moneda o prohibir la tasa a mano.
export class FixedDocumentRates implements DocumentRates {
  baseCurrency = 'USD';
  allowsOverride = true;
  decimals = 2;

  private readonly series: RateSince[] = [
    { currency: 'USD', from: '1900-01-01', rate: 36.5 },
    { currency: 'EUR', from: '1900-01-01', rate: 40 },
  ];

  set(currency: string, from: string, rate: number): this {
    this.series.push({ currency, from, rate });

    return this;
  }

  clear(currency: string): this {
    for (let index = this.series.length - 1; index >= 0; index -= 1) {
      if (this.series[index].currency === currency) this.series.splice(index, 1);
    }

    return this;
  }

  async forDocument(tenantId: string, request: DocumentRateRequest): Promise<DocumentRateSet> {
    const currency = (request.currency ?? this.baseCurrency).trim().toUpperCase();
    const manual = request.manualRate ?? null;

    if (manual !== null) {
      if (!this.allowsOverride) throw new RateOverrideNotAllowedError(tenantId);
      if (currency === 'VES' || currency === this.baseCurrency) throw new FixedExchangeRateError(currency);
    }

    return {
      currency,
      exchangeRate: manual ?? this.rateOn(currency, request.date),
      baseCurrency: this.baseCurrency,
      baseExchangeRate: this.rateOn(this.baseCurrency, request.date),
      manualRate: manual !== null,
    };
  }

  async amountDecimals(): Promise<number> {
    return this.decimals;
  }

  // La de ese dia o la ultima anterior; con dos del mismo dia, la ultima que se cargo.
  private rateOn(currency: string, date: string): number {
    if (currency === 'VES') return 1;

    const found = this.series
      .filter((entry) => entry.currency === currency && entry.from <= date)
      .reduce<RateSince | null>((best, entry) => (best === null || entry.from >= best.from ? entry : best), null);

    if (!found) throw new MissingExchangeRateError(currency, 'legal', date);

    return found.rate;
  }
}
