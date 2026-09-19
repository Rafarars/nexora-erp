import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CannotDropOwnAdminRoleError } from '../../domain/errors/cannot-drop-own-admin-role.error.js';
import { AdministrationPolicy } from '../../domain/membership/administration/administration-policy.js';
import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { RoleRevokerRequest } from './role-revoker.request.js';

// Esta puerta lleva al mismo sitio que editar a la persona, y llegaba sin comprobar nada:
// se podia quitar por aqui la administracion que por la otra estaba protegida.
export class RoleRevoker {
  constructor(
    private readonly finder: MembershipFinder,
    private readonly roles: RoleFinder,
    private readonly memberships: MembershipRepository,
    private readonly administration: TenantAdministration,
    private readonly clock: Clock,
  ) {}

  async run(request: RoleRevokerRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);

    // Comprobar y escribir tienen que ir juntos: dos peticiones a la vez contaban cada una
    // antes de que la otra escribiera, y entre las dos dejaban la empresa sin gobierno.
    await this.administration.whileNobodyElseChangesIt(tenantId, () => this.revoke(tenantId, request));
  }

  private async revoke(tenantId: TenantId, request: RoleRevokerRequest): Promise<void> {
    const userId = UserId.of(request.userId);
    const membership = await this.finder.findByUser(tenantId, userId);
    const role = await this.roles.find(tenantId, RoleId.of(request.roleId));

    membership.revokeRole(role.id, this.clock.now());

    if (role.grantsEverything()) {
      // Con lo que le queda DESPUES de quitarle este: quien tenga otro rol que lo conceda
      // todo sigue administrando y no deja hueco.
      const left = await this.roles.findAll(tenantId, membership.roles());
      const stillAdministers = left.some((remaining) => remaining.grantsEverything());

      if (!stillAdministers && request.actorId === request.userId) {
        throw new CannotDropOwnAdminRoleError();
      }

      await AdministrationPolicy.ensureTenantKeepsAnAdministrator(
        this.administration,
        tenantId,
        userId,
        stillAdministers,
      );
    }

    await this.memberships.save(membership);
  }
}
