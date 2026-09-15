import { TenantId } from '../../shared/tenant-id.vo.js';
import { CompanyProfile } from '../company-profile.entity.js';
import { CompanyProfileRepository } from '../company-profile.repository.js';
import { TenantNames } from '../tenant-names.js';

// Toda empresa tiene datos: la que nunca los lleno se presenta con su nombre registrado.
export class CompanyProfileFinder {
  constructor(
    private readonly profiles: CompanyProfileRepository,
    private readonly names: TenantNames,
  ) {}

  async find(tenantId: TenantId): Promise<CompanyProfile> {
    return (await this.profiles.find(tenantId)) ?? CompanyProfile.blank(tenantId, await this.names.nameOf(tenantId));
  }
}
