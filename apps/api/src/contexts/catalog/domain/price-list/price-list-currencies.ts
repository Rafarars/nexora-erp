import { CurrencyCode } from '../shared/currency-code.vo.js';

export const PRICE_LIST_CURRENCIES = Symbol('PriceListCurrencies');

// Lo unico que el catalogo necesita saber de las monedas: si puede usarse en una lista. Las
// monedas en si las mantiene la empresa.
export interface PriceListCurrencies {
  isUsable(currency: CurrencyCode): Promise<boolean>;
}
