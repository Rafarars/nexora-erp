import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ExchangeRateId } from '../../domain/rate/exchange-rate-id.vo.js';
import { ExchangeRateRepository } from '../../domain/rate/exchange-rate.repository.js';
import { ExchangeRateFinder } from '../../domain/rate/find/exchange-rate-finder.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ExchangeRateStatusChangerRequest {
  tenantId: string;
  rateId: string;
  active: boolean;
}

// Una tasa que no debia existir se desactiva: los documentos pasan a usar la anterior. Los ya
// emitidos conservan la que copiaron.
export class ExchangeRateStatusChanger {
  constructor(
    private readonly finder: ExchangeRateFinder,
    private readonly rates: ExchangeRateRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: ExchangeRateStatusChangerRequest): Promise<void> {
    const rate = await this.finder.find(TenantId.of(request.tenantId), ExchangeRateId.of(request.rateId));

    if (request.active) {
      rate.activate(this.clock.now());
    } else {
      rate.deactivate(this.clock.now());
    }

    await this.rates.save(rate);
  }
}
