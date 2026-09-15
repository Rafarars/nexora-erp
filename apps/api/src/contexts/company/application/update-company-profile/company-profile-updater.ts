import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CompanyProfileInput } from '../../domain/profile/company-profile.entity.js';
import { CompanyProfileRepository } from '../../domain/profile/company-profile.repository.js';
import { CompanyProfileFinder } from '../../domain/profile/find/company-profile-finder.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export interface CompanyProfileUpdaterRequest extends CompanyProfileInput {
  tenantId: string;
}

export class CompanyProfileUpdater {
  constructor(
    private readonly finder: CompanyProfileFinder,
    private readonly profiles: CompanyProfileRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: CompanyProfileUpdaterRequest): Promise<void> {
    const { tenantId, ...input } = request;
    const profile = await this.finder.find(TenantId.of(tenantId));

    profile.update(input, this.clock.now());
    await this.profiles.save(profile);
  }
}
