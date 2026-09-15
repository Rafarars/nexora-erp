import { DocumentRateSet, DocumentRates } from '../../../../../shared/domain/ports/document-rates.js';
import { CurrencyCode } from '../../currency/currency-code.vo.js';
import { CompanySettingsFinder } from '../../settings/find/company-settings-finder.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { RateDate } from '../rate-date.vo.js';
import { RateResolver } from '../resolve/rate-resolver.js';

// Las tasas de un documento, con la serie (legal o interna) que eligio la empresa.
export class CompanyDocumentRates implements DocumentRates {
  constructor(
    private readonly settings: CompanySettingsFinder,
    private readonly resolver: RateResolver,
  ) {}

  async forDocument(tenantId: string, currency: string, date: string): Promise<DocumentRateSet> {
    const tenant = TenantId.of(tenantId);
    const settings = await this.settings.find(tenant);
    const day = RateDate.of(date);
    const document = await this.resolver.rateOn(tenant, CurrencyCode.of(currency), settings.rateType(), day);
    const base = await this.resolver.rateOn(tenant, settings.baseCurrency(), settings.rateType(), day);

    return { currency: document.currency, exchangeRate: document.rate, baseCurrency: base.currency, baseExchangeRate: base.rate };
  }
}
