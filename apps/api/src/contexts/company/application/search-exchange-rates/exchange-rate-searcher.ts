import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CurrencyCatalog } from '../../domain/currency/currency-catalog.js';
import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';
import { ExchangeRateRepository } from '../../domain/rate/exchange-rate.repository.js';
import { RateDate } from '../../domain/rate/rate-date.vo.js';
import { RateType } from '../../domain/rate/rate-type.vo.js';
import { RateResolver } from '../../domain/rate/resolve/rate-resolver.js';
import { CompanySettingsFinder } from '../../domain/settings/find/company-settings-finder.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ExchangeRateSearcherRequest {
  tenantId: string;
  currency?: string;
  type?: string;
  from?: string;
  to?: string;
  // El dia para el que se resuelve la tasa vigente; hoy de la empresa si no viene.
  date?: string;
}

export interface ExchangeRateResponse {
  id: string;
  currency: string;
  rateDate: string;
  type: string;
  rate: number;
  source: string | null;
  isActive: boolean;
}

export interface CurrentRateResponse {
  currency: string;
  name: string;
  rate: number | null;
  rateDate: string | null;
}

export interface ExchangeRateSearcherResponse {
  date: string;
  rateType: string;
  rates: ExchangeRateResponse[];
  // Lo que usaria un documento de ese dia en cada moneda extranjera activa.
  current: CurrentRateResponse[];
}

export class ExchangeRateSearcher {
  constructor(
    private readonly rates: ExchangeRateRepository,
    private readonly resolver: RateResolver,
    private readonly settings: CompanySettingsFinder,
    private readonly currencies: CurrencyCatalog,
    private readonly clock: Clock,
  ) {}

  async run(request: ExchangeRateSearcherRequest): Promise<ExchangeRateSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const currency = request.currency ? CurrencyCode.of(request.currency) : undefined;
    const type = request.type ? RateType.of(request.type) : undefined;
    const from = request.from ? RateDate.of(request.from) : undefined;
    const to = request.to ? RateDate.of(request.to) : undefined;
    const settings = await this.settings.find(tenantId);
    const date = RateDate.of(request.date ?? settings.todayAt(this.clock.now()));
    // Sin tipo pedido, la vigente es la de la serie con que la empresa valora sus documentos.
    const currentType = type ?? settings.rateType();

    const rows = await this.rates.search(tenantId, { currency, type, from, to });
    const foreign = (await this.currencies.searchAll()).filter((candidate) => candidate.isActive && candidate.code !== CurrencyCode.LOCAL);

    return {
      date: date.value,
      rateType: currentType.value,
      rates: rows.map((rate) => {
        const { id, currency: code, rateDate, type: kind, rate: value, source, isActive } = rate.toPrimitives();

        return { id, currency: code, rateDate, type: kind, rate: value, source, isActive };
      }),
      current: await Promise.all(
        foreign.map(async ({ code, name }) => {
          const resolved = await this.resolver.tryRateOn(tenantId, CurrencyCode.of(code), currentType, date);

          return { currency: code, name, rate: resolved?.rate ?? null, rateDate: resolved?.rateDate ?? null };
        }),
      ),
    };
  }
}
