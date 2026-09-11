import { Clock } from '../../../../../shared/domain/ports/clock.js';
import { IdGenerator } from '../../../../../shared/domain/ports/id-generator.js';
import { DuplicateMembershipError } from '../../errors/duplicate-membership.error.js';
import { Role } from '../../role/role.entity.js';
import { Tenant } from '../../tenant/tenant.entity.js';
import { User } from '../../user/user.entity.js';
import { MembershipId } from '../membership-id.vo.js';
import { Membership } from '../membership.entity.js';
import { MembershipRepository } from '../membership.repository.js';

// Dar de alta a alguien en una empresa: nadie entra dos veces a la misma.
export class MemberEnroller {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async enroll(user: User, tenant: Tenant, roles: Role[]): Promise<Membership> {
    const existing = await this.memberships.findByUser(tenant.id, user.id);

    if (existing) {
      throw new DuplicateMembershipError(user.id.value, tenant.id.value);
    }

    const membership = Membership.create(
      MembershipId.of(this.ids.next()),
      user.id,
      tenant.id,
      roles.map((role) => role.id),
      this.clock.now(),
    );

    await this.memberships.save(membership);

    return membership;
  }
}
