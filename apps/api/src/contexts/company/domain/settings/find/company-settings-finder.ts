import { TenantId } from '../../shared/tenant-id.vo.js';
import { CompanySettings } from '../company-settings.entity.js';
import { CompanySettingsRepository } from '../company-settings.repository.js';

// Toda empresa tiene configuracion: la que nunca la guardo lee los valores por defecto, sin escribir
// nada al consultar.
export class CompanySettingsFinder {
  constructor(private readonly settings: CompanySettingsRepository) {}

  async find(tenantId: TenantId): Promise<CompanySettings> {
    return (await this.settings.find(tenantId)) ?? CompanySettings.defaults(tenantId);
  }
}
