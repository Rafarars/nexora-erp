import { TenantAdministration } from '../../domain/membership/administration/tenant-administration.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { UserRepository } from '../../domain/user/user.repository.js';

// Cuenta de verdad recorriendo los mismos datos, no devuelve un numero preparado: un
// doble que responde lo que la prueba quiere oir no prueba nada. El contrato lo corre
// contra esto y contra PostgreSQL para que ambos cuenten igual.
export class InMemoryTenantAdministration implements TenantAdministration {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
  ) {}

  async countAdministratorsExcept(tenantId: TenantId, userId: UserId): Promise<number> {
    const all = await this.memberships.searchByTenant(tenantId);
    let administrators = 0;

    for (const membership of all) {
      if (membership.userId.equals(userId) || !membership.isActive()) {
        continue;
      }

      const person = await this.users.find(membership.userId);

      if (!person?.isActive()) {
        continue;
      }

      const granted = await this.roles.searchByIds(tenantId, membership.roles());

      if (granted.some((role) => role.grantsEverything())) {
        administrators += 1;
      }
    }

    return administrators;
  }
}
