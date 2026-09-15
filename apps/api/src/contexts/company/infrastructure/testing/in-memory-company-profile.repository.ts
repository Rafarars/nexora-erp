import { CompanyProfile, CompanyProfilePrimitives } from '../../domain/profile/company-profile.entity.js';
import { CompanyProfileRepository } from '../../domain/profile/company-profile.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryCompanyProfileRepository implements CompanyProfileRepository {
  private readonly rows = new Map<string, CompanyProfilePrimitives>();

  async find(tenantId: TenantId): Promise<CompanyProfile | null> {
    const row = this.rows.get(tenantId.value);

    return row ? CompanyProfile.fromPrimitives(row) : null;
  }

  async save(profile: CompanyProfile): Promise<void> {
    const row = profile.toPrimitives();

    this.rows.set(row.tenantId, structuredClone(row));
  }
}
