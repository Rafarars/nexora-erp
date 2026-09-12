import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';
import { UserSearcherRequest } from './user-searcher.request.js';
import { TenantUserResponse, UserSearcherResponse } from './user-searcher.response.js';

// Los usuarios DE una empresa se listan desde las membresias, no desde los usuarios:
// la tabla de personas no sabe de empresas.
export class UserSearcher {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
  ) {}

  async run(request: UserSearcherRequest): Promise<UserSearcherResponse> {
    const tenantId = TenantId.of(request.tenantId);
    const memberships = await this.memberships.searchByTenant(tenantId);
    const people = await this.users.searchByIds(memberships.map((membership) => membership.userId));
    const roles = await this.roles.searchByTenant(tenantId);

    const users = memberships.flatMap<TenantUserResponse>((membership) => {
      const person = people.find((candidate) => candidate.id.equals(membership.userId));

      if (!person) {
        return [];
      }

      const primitives = person.toPrimitives();

      return [
        {
          userId: primitives.id,
          email: primitives.email,
          name: primitives.name,
          isActive: primitives.isActive,
          membershipActive: membership.isActive(),
          roles: roles
            .filter((role) => membership.hasRole(role.id))
            .map((role) => role.toPrimitives().name)
            .sort(),
          roleIds: membership.roles().map((id) => id.value),
        },
      ];
    });

    return { users: users.sort((left, right) => left.email.localeCompare(right.email)) };
  }
}
