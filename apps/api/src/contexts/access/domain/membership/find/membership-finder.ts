import { MembershipNotFoundError } from '../../errors/membership-not-found.error.js';
import { TenantId } from '../../tenant/tenant-id.vo.js';
import { UserId } from '../../user/user-id.vo.js';
import { Membership } from '../membership.entity.js';
import { MembershipRepository } from '../membership.repository.js';

export class MembershipFinder {
  constructor(private readonly memberships: MembershipRepository) {}

  async findByUser(tenantId: TenantId, userId: UserId): Promise<Membership> {
    const membership = await this.memberships.findByUser(tenantId, userId);

    if (!membership) {
      throw new MembershipNotFoundError(userId.value, tenantId.value);
    }

    return membership;
  }
}
