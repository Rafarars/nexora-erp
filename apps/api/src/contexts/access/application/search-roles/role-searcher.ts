import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { RoleSearcherResponse } from './role-searcher.response.js';

export class RoleSearcher {
  constructor(private readonly roles: RoleRepository) {}

  async run(request: { tenantId: string }): Promise<RoleSearcherResponse> {
    const roles = await this.roles.searchByTenant(TenantId.of(request.tenantId));

    return {
      roles: roles
        .map((role) => {
          const { id, name, grantsAll, permissions } = role.toPrimitives();

          return { id, name, grantsAll, permissions: [...permissions].sort() };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }
}
