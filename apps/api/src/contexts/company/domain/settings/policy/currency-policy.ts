import { CurrencyCatalog } from '../../currency/currency-catalog.js';
import { CurrencyCode } from '../../currency/currency-code.vo.js';
import { BaseCurrencyLockedError, InactiveCurrencyError, UnknownCurrencyError } from '../../errors/company.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { CompanySettings, CompanySettingsDetails } from '../company-settings.entity.js';
import { CompanyActivity } from './company-activity.js';

// Las monedas elegidas existen y estan activas, salvo la que la empresa ya tenia. La principal no
// cambia con documentos confirmados, como en SAP Business One.
export class CurrencyPolicy {
  constructor(
    private readonly currencies: CurrencyCatalog,
    private readonly activity: CompanyActivity,
  ) {}

  async ensureCanApply(tenantId: TenantId, current: CompanySettings, details: CompanySettingsDetails): Promise<void> {
    await this.ensureUsable(details.baseCurrency, current.baseCurrency());

    if (details.secondaryCurrency) {
      await this.ensureUsable(details.secondaryCurrency, current.secondaryCurrency());
    }

    if (current.changesBaseCurrency(details) && (await this.activity.hasConfirmedDocuments(tenantId))) {
      throw new BaseCurrencyLockedError(tenantId.value);
    }
  }

  private async ensureUsable(code: CurrencyCode, kept: CurrencyCode | null): Promise<void> {
    const currency = await this.currencies.find(code);

    if (!currency) throw new UnknownCurrencyError(code.value);
    if (!currency.isActive && !(kept?.equals(code) ?? false)) throw new InactiveCurrencyError(code.value);
  }
}
