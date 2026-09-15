import { CompanySettings, CompanySettingsPrimitives } from '../../domain/settings/company-settings.entity.js';
import { CompanySettingsRepository } from '../../domain/settings/company-settings.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryCompanySettingsRepository implements CompanySettingsRepository {
  private readonly rows = new Map<string, CompanySettingsPrimitives>();

  async find(tenantId: TenantId): Promise<CompanySettings | null> {
    const row = this.rows.get(tenantId.value);

    return row ? CompanySettings.fromPrimitives(row) : null;
  }

  async save(settings: CompanySettings): Promise<void> {
    const row = settings.toPrimitives();

    this.rows.set(row.tenantId, structuredClone(row));
  }
}
