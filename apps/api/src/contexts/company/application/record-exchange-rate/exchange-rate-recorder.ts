import { Clock } from '../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';
import { ExchangeRateId } from '../../domain/rate/exchange-rate-id.vo.js';
import { ExchangeRate, ExchangeRateInput, exchangeRateDetailsOf } from '../../domain/rate/exchange-rate.entity.js';
import { ExchangeRateRepository } from '../../domain/rate/exchange-rate.repository.js';
import { RateCurrencyPolicy } from '../../domain/rate/policy/rate-currency-policy.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface ExchangeRateRecorderRequest extends ExchangeRateInput {
  tenantId: string;
}

// Carga una tasa o corrige la que ya hay de esa moneda, fecha y tipo.
export class ExchangeRateRecorder {
  constructor(
    private readonly rates: ExchangeRateRepository,
    private readonly policy: RateCurrencyPolicy,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async run(request: ExchangeRateRecorderRequest): Promise<{ id: string }> {
    const tenantId = TenantId.of(request.tenantId);
    // Primero lo que no necesita la base: un valor invalido responde 400 sin consultar.
    const details = exchangeRateDetailsOf(request);
    const existing = await this.rates.findByKey(tenantId, details.key);

    await this.policy.ensureCanRecord(details.key.currency, existing !== null);

    const now = this.clock.now();
    const rate = existing ?? ExchangeRate.record(ExchangeRateId.of(this.ids.next()), tenantId, details, now);

    if (existing) existing.correct(details, now);

    await this.rates.save(rate);

    return { id: rate.id.value };
  }
}
