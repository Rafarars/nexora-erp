import { TenantNames } from '../../domain/profile/tenant-names.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

export class InMemoryTenantNames implements TenantNames {
  constructor(private readonly names: Record<string, string> = {}) {}

  async nameOf(tenantId: TenantId): Promise<string> {
    const name = this.names[tenantId.value];

    if (name === undefined) throw new Error(`Tenant <${tenantId.value}> is not in the test.`);

    return name;
  }
}
