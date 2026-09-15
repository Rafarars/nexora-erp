import { Currency, CurrencyCatalog } from '../../domain/currency/currency-catalog.js';
import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';
import { CURRENCIES } from '../../domain/testing/company.mother.js';

export class InMemoryCurrencyCatalog implements CurrencyCatalog {
  constructor(private readonly currencies: Currency[] = CURRENCIES) {}

  async searchAll(): Promise<Currency[]> {
    return this.currencies.map((currency) => ({ ...currency }));
  }

  async find(code: CurrencyCode): Promise<Currency | null> {
    const currency = this.currencies.find((candidate) => candidate.code === code.value);

    return currency ? { ...currency } : null;
  }
}
