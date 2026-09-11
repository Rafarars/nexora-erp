import { Clock } from '../../../../shared/domain/ports/clock.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { RoleRevokerRequest } from './role-revoker.request.js';

export class RoleRevoker {
  constructor(
    private readonly finder: MembershipFinder,
    private readonly roles: RoleFinder,
    private readonly memberships: MembershipRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleRevokerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const membership = await this.finder.findByUser(tenantId, UserId.of(request.userId));
    const role = await this.roles.find(tenantId, RoleId.of(request.roleId));

    membership.revokeRole(role.id, this.clock.now());

    await this.memberships.save(membership);
  }
}
