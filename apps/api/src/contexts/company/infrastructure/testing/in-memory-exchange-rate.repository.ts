import { CurrencyCode } from '../../domain/currency/currency-code.vo.js';
import { DuplicateExchangeRateError } from '../../domain/errors/company.errors.js';
import { ExchangeRateId } from '../../domain/rate/exchange-rate-id.vo.js';
import { ExchangeRate, ExchangeRateKey, ExchangeRatePrimitives } from '../../domain/rate/exchange-rate.entity.js';
import { ExchangeRateFilter, ExchangeRateRepository, RATE_SEARCH_LIMIT } from '../../domain/rate/exchange-rate.repository.js';
import { RateDate } from '../../domain/rate/rate-date.vo.js';
import { RateType } from '../../domain/rate/rate-type.vo.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

const sameKey = (row: ExchangeRatePrimitives, tenantId: string, currency: string, type: string, rateDate: string) =>
  row.tenantId === tenantId && row.currency === currency && row.type === type && row.rateDate === rateDate;

export class InMemoryExchangeRateRepository implements ExchangeRateRepository {
  private readonly rows = new Map<string, ExchangeRatePrimitives>();

  async save(rate: ExchangeRate): Promise<void> {
    const row = rate.toPrimitives();
    const clash = [...this.rows.values()].find((other) => other.id !== row.id && sameKey(other, row.tenantId, row.currency, row.type, row.rateDate));

    if (clash) throw new DuplicateExchangeRateError(row.currency, row.type, row.rateDate);

    this.rows.set(row.id, structuredClone(row));
  }

  async find(tenantId: TenantId, id: ExchangeRateId): Promise<ExchangeRate | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? ExchangeRate.fromPrimitives(row) : null;
  }

  async findByKey(tenantId: TenantId, key: ExchangeRateKey): Promise<ExchangeRate | null> {
    const row = [...this.rows.values()].find((candidate) =>
      sameKey(candidate, tenantId.value, key.currency.value, key.type.value, key.rateDate.value),
    );

    return row ? ExchangeRate.fromPrimitives(row) : null;
  }

  async latestOnOrBefore(tenantId: TenantId, currency: CurrencyCode, type: RateType, date: RateDate): Promise<ExchangeRate | null> {
    const row = [...this.rows.values()]
      .filter((candidate) => candidate.tenantId === tenantId.value && candidate.currency === currency.value && candidate.type === type.value)
      .filter((candidate) => candidate.isActive && candidate.rateDate <= date.value)
      .sort((left, right) => right.rateDate.localeCompare(left.rateDate))[0];

    return row ? ExchangeRate.fromPrimitives(row) : null;
  }

  async search(tenantId: TenantId, filter: ExchangeRateFilter): Promise<ExchangeRate[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .filter((row) => !filter.currency || row.currency === filter.currency.value)
      .filter((row) => !filter.type || row.type === filter.type.value)
      .filter((row) => (!filter.from || row.rateDate >= filter.from.value) && (!filter.to || row.rateDate <= filter.to.value))
      .sort((left, right) => right.rateDate.localeCompare(left.rateDate) || left.currency.localeCompare(right.currency) || left.type.localeCompare(right.type))
      .slice(0, RATE_SEARCH_LIMIT)
      .map((row) => ExchangeRate.fromPrimitives(row));
  }
}
