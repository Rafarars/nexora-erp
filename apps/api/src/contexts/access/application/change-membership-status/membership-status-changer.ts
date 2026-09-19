import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CannotDeactivateSelfError } from '../../domain/errors/cannot-deactivate-self.error.js';
import { AdministrationPolicy } from '../../domain/membership/administration/administration-policy.js';
import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
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
    private readonly roles: RoleFinder,
    private readonly memberships: MembershipRepository,
    private readonly administration: TenantAdministration,
    private readonly clock: Clock,
  ) {}

  async run(request: MembershipStatusChangerRequest): Promise<void> {
    if (!request.active && request.actorId === request.userId) {
      throw new CannotDeactivateSelfError();
    }

    const tenantId = TenantId.of(request.tenantId);

    // Junto con la comprobacion, por la misma carrera que en los otros dos caminos.
    await this.administration.whileNobodyElseChangesIt(tenantId, () => this.change(tenantId, request));
  }

  private async change(tenantId: TenantId, request: MembershipStatusChangerRequest): Promise<void> {
    const userId = UserId.of(request.userId);
    const membership = await this.finder.findByUser(tenantId, userId);
    const now = this.clock.now();

    if (request.active) {
      membership.restore(now);

      await this.memberships.save(membership);

      return;
    }

    // Quien queda desactivado deja de administrar aunque conserve el rol, asi que cuenta
    // igual que quitarselo: es la misma perdida por otra puerta.
    const current = await this.roles.findAll(tenantId, membership.roles());

    if (current.some((role) => role.grantsEverything())) {
      await AdministrationPolicy.ensureTenantKeepsAnAdministrator(
        this.administration,
        tenantId,
        userId,
        false,
      );
    }

    membership.revoke(now);

    await this.memberships.save(membership);
  }
}
