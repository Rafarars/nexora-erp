import {
  DocumentRateRequest,
  DocumentRateSet,
  DocumentRates,
  FixedExchangeRateError,
  RateOverrideNotAllowedError,
} from '../../../../../shared/domain/ports/document-rates.js';
import { CurrencyCatalog } from '../../currency/currency-catalog.js';
import { CurrencyCode } from '../../currency/currency-code.vo.js';
import { InactiveCurrencyError, UnknownCurrencyError } from '../../errors/company.errors.js';
import { CompanySettingsFinder } from '../../settings/find/company-settings-finder.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { RateDate } from '../rate-date.vo.js';
import { RateValue } from '../rate-value.vo.js';
import { RateResolver } from '../resolve/rate-resolver.js';

// Las tasas de un documento, con la serie (legal o interna) que eligio la empresa. Una tasa escrita a
// mano solo vale si la empresa lo permite y nunca para su propia moneda ni para el bolivar.
export class CompanyDocumentRates implements DocumentRates {
  constructor(
    private readonly settings: CompanySettingsFinder,
    private readonly resolver: RateResolver,
    private readonly currencies: CurrencyCatalog,
  ) {}

  async forDocument(tenantId: string, request: DocumentRateRequest): Promise<DocumentRateSet> {
    const tenant = TenantId.of(tenantId);
    const settings = await this.settings.find(tenant);
    const day = RateDate.of(request.date);
    const base = settings.baseCurrency();
    const currency = request.currency ? CurrencyCode.of(request.currency) : base;
    const manual = request.manualRate ?? null;

    await this.ensureUsable(currency, request.keepsCurrency ?? false);

    // Lo que no depende de las tasas se rechaza antes de buscarlas.
    if (manual !== null) {
      if (!settings.allowsRateOverride()) throw new RateOverrideNotAllowedError(tenantId);
      if (currency.isLocal() || currency.equals(base)) throw new FixedExchangeRateError(currency.value);
    }

    const written = manual === null ? null : RateValue.of(manual).value;
    const baseRate = await this.resolver.rateOn(tenant, base, settings.rateType(), day);
    const documentRate = written ?? (currency.equals(base) ? baseRate.rate : (await this.resolver.rateOn(tenant, currency, settings.rateType(), day)).rate);

    return { currency: currency.value, exchangeRate: documentRate, baseCurrency: base.value, baseExchangeRate: baseRate.rate, manualRate: written !== null };
  }

  async amountDecimals(tenantId: string): Promise<number> {
    return (await this.settings.find(TenantId.of(tenantId))).toPrimitives().amountDecimals;
  }

  async priceDecimals(tenantId: string): Promise<number> {
    return (await this.settings.find(TenantId.of(tenantId))).toPrimitives().priceDecimals;
  }

  async companyCurrency(tenantId: string): Promise<string> {
    return (await this.settings.find(TenantId.of(tenantId))).baseCurrency().value;
  }

  private async ensureUsable(code: CurrencyCode, keeps: boolean): Promise<void> {
    const currency = await this.currencies.find(code);

    if (!currency) throw new UnknownCurrencyError(code.value);
    if (!currency.isActive && !keeps) throw new InactiveCurrencyError(code.value);
  }
}
