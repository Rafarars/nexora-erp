import { Clock } from '../../../../shared/domain/ports/clock.js';
import { CannotDropOwnAdminRoleError } from '../../domain/errors/cannot-drop-own-admin-role.error.js';
import { SelfEscalationPolicy } from '../../domain/authorize/self-escalation-policy.js';
import { AdministrationPolicy } from '../../domain/membership/administration/administration-policy.js';
import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { MembershipFinder } from '../../domain/membership/find/membership-finder.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleFinder } from '../../domain/role/find/role-finder.js';
import { RoleId } from '../../domain/role/role-id.vo.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserFinder } from '../../domain/user/find/user-finder.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserName } from '../../domain/user/user-name.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

export interface TenantUserUpdaterRequest {
  tenantId: string;
  // Quien hace el cambio: hace falta para no dejarle quitarse a si mismo la administracion.
  actorId: string;
  userId: string;
  name: string;
  roleIds: string[];
}

// Lo que un administrador puede cambiar de otra persona. Correo y contrasena quedan
// fuera A PROPOSITO: son la llave de la cuenta en todas sus empresas, y dejar que el
// administrador de una la cambie le daria acceso a las demas.
export class TenantUserUpdater {
  constructor(
    private readonly memberships: MembershipFinder,
    private readonly users: UserFinder,
    private readonly roles: RoleFinder,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly administration: TenantAdministration,
    private readonly clock: Clock,
  ) {}

  async run(request: TenantUserUpdaterRequest): Promise<void> {
    const tenantId = TenantId.of(request.tenantId);

    // Junto con la comprobacion, por la misma carrera que en los otros dos caminos.
    await this.administration.whileNobodyElseChangesIt(tenantId, () => this.update(tenantId, request));
  }

  private async update(tenantId: TenantId, request: TenantUserUpdaterRequest): Promise<void> {
    const userId = UserId.of(request.userId);

    // Primero la membresia: si la persona no esta en esta empresa, responde como
    // inexistente y no se llega a tocar nada suyo.
    const membership = await this.memberships.findByUser(tenantId, userId);
    const roles = await this.roles.findAll(tenantId, request.roleIds.map((id) => RoleId.of(id)));
    const user = await this.users.find(userId);
    const now = this.clock.now();

    if (request.actorId === request.userId) {
      SelfEscalationPolicy.ensureGrantsNothingNew(
        tenantId,
        await this.roles.findAll(tenantId, membership.roles()),
        roles,
      );
    }

    // Solo importa si la persona administraba y deja de hacerlo.
    if (!roles.some((role) => role.grantsEverything())) {
      const current = await this.roles.findAll(tenantId, membership.roles());

      if (current.some((role) => role.grantsEverything())) {
        // Quitarselo a uno mismo tiene su propio porque; quitarselo al ultimo que queda
        // deja a la empresa sin gobierno lo haga quien lo haga.
        if (request.actorId === request.userId) throw new CannotDropOwnAdminRoleError();

        await AdministrationPolicy.ensureTenantKeepsAnAdministrator(
          this.administration,
          tenantId,
          userId,
          false,
        );
      }
    }

    user.rename(UserName.of(request.name), now);
    membership.replaceRoles(roles.map((role) => role.id), now);

    await this.userRepository.save(user);
    await this.membershipRepository.save(membership);
  }
}
