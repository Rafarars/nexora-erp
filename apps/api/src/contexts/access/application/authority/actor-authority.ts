import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { Role } from '../../domain/role/role.entity.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

// Hasta donde llega quien esta haciendo el cambio. Lo piden los cinco caminos que
// reparten acceso, y tenerlo en un sitio evita que cada uno lo resuelva a su manera.
export class ActorAuthority {
  constructor(
    private readonly memberships: MembershipFinder,
    private readonly roles: RoleFinder,
  ) {}

  async of(tenantId: TenantId, actorId: string): Promise<Role[]> {
    const membership = await this.memberships.findByUser(tenantId, UserId.of(actorId));

    return this.roles.findAll(tenantId, membership.roles());
  }
}
