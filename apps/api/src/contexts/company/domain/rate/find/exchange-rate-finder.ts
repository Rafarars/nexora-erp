import { ExchangeRateNotFoundError } from '../../errors/company.errors.js';
import { TenantId } from '../../shared/tenant-id.vo.js';
import { ExchangeRateId } from '../exchange-rate-id.vo.js';
import { ExchangeRate } from '../exchange-rate.entity.js';
import { ExchangeRateRepository } from '../exchange-rate.repository.js';

export class ExchangeRateFinder {
  constructor(private readonly rates: ExchangeRateRepository) {}

  async find(tenantId: TenantId, id: ExchangeRateId): Promise<ExchangeRate> {
    const rate = await this.rates.find(tenantId, id);

    if (!rate) throw new ExchangeRateNotFoundError(id.value);

    return rate;
  }
}
