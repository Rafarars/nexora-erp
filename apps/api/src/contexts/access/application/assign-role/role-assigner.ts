import { Clock } from '../../../../shared/domain/ports/clock.js';
import { ActorAuthority } from '../authority/actor-authority.js';
import { GrantPolicy } from '../../domain/authorize/grant-policy.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { RoleAssignerRequest } from './role-assigner.request.js';

export class RoleAssigner {
  constructor(
    private readonly finder: MembershipFinder,
    private readonly roles: RoleFinder,
    private readonly memberships: MembershipRepository,
    private readonly authority: ActorAuthority,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleAssignerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);
    const membership = await this.finder.findByUser(tenantId, UserId.of(request.userId));
    const role = await this.roles.find(tenantId, RoleId.of(request.roleId));

    // A cualquiera, no solo a uno mismo: repartirlo a un companero complice y entrar con
    // su cuenta llevaba al mismo sitio.
    GrantPolicy.ensureRolesWithinReach(tenantId, await this.authority.of(tenantId, request.actorId), [role]);

    membership.assignRole(role.id, this.clock.now());

    await this.memberships.save(membership);
  }
}
