import { CurrencyCatalog } from '../../currency/currency-catalog.js';
import { CurrencyCode } from '../../currency/currency-code.vo.js';
import { InactiveCurrencyError, UnknownCurrencyError } from '../../errors/company.errors.js';

// La moneda de una tasa existe. Una retirada del catalogo no recibe tasas nuevas, pero la que ya
// tenia se puede corregir: un documento viejo pudo haberla usado.
export class RateCurrencyPolicy {
  constructor(private readonly currencies: CurrencyCatalog) {}

  async ensureCanRecord(code: CurrencyCode, correcting: boolean): Promise<void> {
    const currency = await this.currencies.find(code);

    if (!currency) throw new UnknownCurrencyError(code.value);
    if (!currency.isActive && !correcting) throw new InactiveCurrencyError(code.value);
  }
}
