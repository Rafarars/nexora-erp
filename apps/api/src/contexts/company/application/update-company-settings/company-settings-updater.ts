import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CompanySettingsInput, settingsDetailsOf } from '../../domain/settings/company-settings.entity.js';
import { CompanySettingsRepository } from '../../domain/settings/company-settings.repository.js';
import { CompanySettingsFinder } from '../../domain/settings/find/company-settings-finder.js';
import { CurrencyPolicy } from '../../domain/settings/policy/currency-policy.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CompanySettingsUpdaterRequest extends CompanySettingsInput {
  tenantId: string;
}

export class CompanySettingsUpdater {
  constructor(
    private readonly finder: CompanySettingsFinder,
    private readonly policy: CurrencyPolicy,
    private readonly settings: CompanySettingsRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: CompanySettingsUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    // Primero lo que no necesita la base: un valor invalido responde 400 sin consultar.
    const details = settingsDetailsOf(request);
    const current = await this.finder.find(tenantId);

    await this.policy.ensureCanApply(tenantId, current, details);

    current.update(details, this.clock.now());
    await this.settings.save(current);
  }
}
