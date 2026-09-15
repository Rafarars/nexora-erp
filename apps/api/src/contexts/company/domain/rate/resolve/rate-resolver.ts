import { CurrencyCode } from '../../currency/currency-code.vo.js';
import { MissingExchangeRateError } from '../../../../../shared/domain/ports/document-rates.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ExchangeRateRepository } from '../exchange-rate.repository.js';
import { RateDate } from '../rate-date.vo.js';
import { RateType } from '../rate-type.vo.js';

export interface ResolvedRate {
  currency: string;
  rate: number;
  // El dia de la tasa usada; null para el bolivar, que no la necesita.
  rateDate: string | null;
}

// La tasa de un dia: la de esa fecha o, si no hay (fines de semana y feriados), la ultima anterior.
// Nunca una posterior. Es la unica forma de resolverla: ningun modulo busca tasas por su cuenta.
export class RateResolver {
  constructor(private readonly rates: ExchangeRateRepository) {}

  // Para quien muestra: sin tasa devuelve null.
  async tryRateOn(tenantId: TenantId, currency: CurrencyCode, type: RateType, date: RateDate): Promise<ResolvedRate | null> {
    if (currency.isLocal()) return { currency: currency.value, rate: 1, rateDate: null };

    const found = await this.rates.latestOnOrBefore(tenantId, currency, type, date);

    return found ? { currency: currency.value, rate: found.value(), rateDate: found.key.rateDate.value } : null;
  }

  // Para quien emite: sin tasa rechaza.
  async rateOn(tenantId: TenantId, currency: CurrencyCode, type: RateType, date: RateDate): Promise<ResolvedRate> {
    const resolved = await this.tryRateOn(tenantId, currency, type, date);

    if (!resolved) throw new MissingExchangeRateError(currency.value, type.value, date.value);

    return resolved;
  }
}
