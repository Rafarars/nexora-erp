import { TenantId } from '../shared/tenant-id.vo.js';
import { CompanyProfile } from './company-profile.entity.js';

export const COMPANY_PROFILE_REPOSITORY = Symbol('CompanyProfileRepository');

export interface CompanyProfileRepository {
  // null si la empresa nunca lleno sus datos.
  find(tenantId: TenantId): Promise<CompanyProfile | null>;
  save(profile: CompanyProfile): Promise<void>;
}
