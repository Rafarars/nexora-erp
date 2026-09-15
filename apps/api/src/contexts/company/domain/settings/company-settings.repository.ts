import { TenantId } from '../shared/tenant-id.vo.js';
import { CompanySettings } from './company-settings.entity.js';

export const COMPANY_SETTINGS_REPOSITORY = Symbol('CompanySettingsRepository');

export interface CompanySettingsRepository {
  // null si la empresa nunca la guardo.
  find(tenantId: TenantId): Promise<CompanySettings | null>;
  save(settings: CompanySettings): Promise<void>;
}
