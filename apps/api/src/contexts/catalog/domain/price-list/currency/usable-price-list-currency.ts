import { UnknownPriceListCurrencyError } from '../../errors/price-list.errors.js';
import { CurrencyCode } from '../../shared/currency-code.vo.js';
import { PriceListCurrencies } from '../price-list-currencies.js';

// Una lista en una moneda apagada no serviria para cotizar: no habria tasa con la que convertir
// sus precios a la del documento.
export class UsablePriceListCurrency {
  constructor(private readonly currencies: PriceListCurrencies) {}

  async ensureUsable(currency: CurrencyCode): Promise<void> {
    if (!(await this.currencies.isUsable(currency))) {
      throw new UnknownPriceListCurrencyError(currency.value);
    }
  }
}
