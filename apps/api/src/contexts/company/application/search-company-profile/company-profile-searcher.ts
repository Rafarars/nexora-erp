import { CompanyProfileFinder } from '../../domain/profile/find/company-profile-finder.js';
import { CompanyProfilePrimitives } from '../../domain/profile/company-profile.entity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export type CompanyProfileResponse = Omit<CompanyProfilePrimitives, 'tenantId' | 'updatedAt'>;

export class CompanyProfileSearcher {
  constructor(private readonly finder: CompanyProfileFinder) {}

  async run(request: { tenantId: string }): Promise<CompanyProfileResponse> {
    const { tenantId: _tenant, updatedAt: _updated, ...profile } = (await this.finder.find(TenantId.of(request.tenantId))).toPrimitives();

    return profile;
  }
}
