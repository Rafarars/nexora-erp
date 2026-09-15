import { Clock } from '../../../../shared/domain/ports/clock.js';
import { Currency, CurrencyCatalog } from '../../domain/currency/currency-catalog.js';
import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';
import { CompanySettingsFinder } from '../../domain/settings/find/company-settings-finder.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

type CurrencyResponse = Omit<Currency, 'isActive'>;

export interface CompanySettingsResponse {
  baseCurrency: CurrencyResponse;
  secondaryCurrency: CurrencyResponse | null;
  dualCurrency: boolean;
  timeZone: string;
  amountDecimals: number;
  priceDecimals: number;
  rateType: string;
  allowsRateOverride: boolean;
  // Hoy en la zona de la empresa: la interfaz lo propone como fecha de cada documento.
  today: string;
}

// Lo leen todas las pantallas: la moneda y los decimales para mostrar importes, y el dia de hoy.
export class CompanySettingsSearcher {
  constructor(
    private readonly finder: CompanySettingsFinder,
    private readonly currencies: CurrencyCatalog,
    private readonly clock: Clock,
  ) {}

  async run(request: { tenantId: string }): Promise<CompanySettingsResponse> {
    const settings = await this.finder.find(TenantId.of(request.tenantId));
    const row = settings.toPrimitives();

    return {
      baseCurrency: await this.describe(row.baseCurrency),
      secondaryCurrency: row.secondaryCurrency ? await this.describe(row.secondaryCurrency) : null,
      dualCurrency: settings.usesDualCurrency(),
      timeZone: row.timeZone,
      amountDecimals: row.amountDecimals,
      priceDecimals: row.priceDecimals,
      rateType: row.rateType,
      allowsRateOverride: row.allowsRateOverride,
      today: settings.todayAt(this.clock.now()),
    };
  }

  private async describe(code: string): Promise<CurrencyResponse> {
    const currency = await this.currencies.find(CurrencyCode.of(code));

    return { code, name: currency?.name ?? code, symbol: currency?.symbol ?? code, decimals: currency?.decimals ?? 2 };
  }
}
