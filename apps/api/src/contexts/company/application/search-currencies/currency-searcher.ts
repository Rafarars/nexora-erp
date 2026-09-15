import { Currency, CurrencyCatalog } from '../../domain/currency/currency-catalog.js';

export class CurrencySearcher {
  constructor(private readonly currencies: CurrencyCatalog) {}

  async run(): Promise<{ currencies: Currency[] }> {
    return { currencies: await this.currencies.searchAll() };
  }
}
