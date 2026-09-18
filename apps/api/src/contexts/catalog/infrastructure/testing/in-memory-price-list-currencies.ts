import { PriceListCurrencies } from '../../domain/price-list/price-list-currencies.js';
import { CurrencyCode } from '../../domain/shared/currency-code.vo.js';

export class InMemoryPriceListCurrencies implements PriceListCurrencies {
  constructor(private readonly usable: string[] = ['USD', 'EUR', 'VES']) {}

  async isUsable(currency: CurrencyCode): Promise<boolean> {
    return this.usable.includes(currency.value);
  }
}
