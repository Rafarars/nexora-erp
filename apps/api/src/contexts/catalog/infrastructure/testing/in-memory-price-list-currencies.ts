import { PriceListCurrencies } from '../../domain/price-list/price-list-currencies.js';
import { CurrencyCode } from '../../domain/shared/currency-code.vo.js';

// Las monedas con su estado, como en la base: una moneda apagada existe pero no sirve para cotizar,
// y eso es distinto de una que no existe.
export class InMemoryPriceListCurrencies implements PriceListCurrencies {
  constructor(
    private readonly currencies: { code: string; isActive: boolean }[] = [
      { code: 'USD', isActive: true },
      { code: 'EUR', isActive: true },
      { code: 'VES', isActive: true },
    ],
  ) {}

  async isUsable(currency: CurrencyCode): Promise<boolean> {
    return this.currencies.some((candidate) => candidate.code === currency.value && candidate.isActive);
  }
}
