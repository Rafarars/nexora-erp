import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CannotDeactivateSelfError } from '../../domain/errors/cannot-deactivate-self.error.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';

export interface MembershipStatusChangerRequest {
  tenantId: string;
  actorId: string;
  userId: string;
  active: boolean;
}

// Desactiva a la persona EN ESTA EMPRESA, no su cuenta: sigue entrando en las demas.
export class MembershipStatusChanger {
  constructor(
    private readonly finder: MembershipFinder,
    private readonly memberships: MembershipRepository,
    private readonly clock: Clock,
  ) {}

  async run(request: MembershipStatusChangerRequest): Promise<void> {
    if (!request.active && request.actorId === request.userId) {
      throw new CannotDeactivateSelfError();
    }

    const membership = await this.finder.findByUser(
      TenantId.of(request.tenantId),
      UserId.of(request.userId),
    );
    const now = this.clock.now();

    if (request.active) {
      membership.restore(now);
    } else {
      membership.revoke(now);
    }

    await this.memberships.save(membership);
  }
}
