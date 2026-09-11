import { PermissionChecker } from '../../domain/authorize/permission-checker.js';
import { Membership } from '../../domain/membership/membership.entity.js';
import { MembershipRepository } from '../../domain/membership/membership.repository.js';
import { RoleRepository } from '../../domain/role/role.repository.js';
import { Tenant } from '../../domain/tenant/tenant.entity.js';
import { TenantRepository } from '../../domain/tenant/tenant.repository.js';
import { User } from '../../domain/user/user.entity.js';
import { AccessSessionResponse } from './access-session.response.js';

// Iniciar sesion y cambiar de empresa terminan igual: mismos permisos, misma lista de
// empresas. Compartir el armado evita que un dia devuelvan cosas distintas.
export class AccessSessionBuilder {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly memberships: MembershipRepository,
    private readonly roles: RoleRepository,
  ) {}

  async build(user: User, tenant: Tenant, membership: Membership): Promise<AccessSessionResponse> {
    const roles = await this.roles.searchByIds(tenant.id, membership.roles());
    const available = await this.availableTenants(user);

    return {
      userId: user.id.value,
      name: user.toPrimitives().name,
      email: user.emailAddress().value,
      tenantId: tenant.id.value,
      tenantName: tenant.toPrimitives().name,
      permissions: PermissionChecker.effectivePermissions(roles, tenant.id),
      grantsAll: PermissionChecker.grantsEverything(roles, tenant.id),
      availableTenants: available,
    };
  }

  // Solo las empresas donde la membresia esta activa Y la empresa tambien: el selector
  // no debe ofrecer una puerta que luego no abre.
  private async availableTenants(user: User): Promise<AccessSessionResponse['availableTenants']> {
    const memberships = await this.memberships.searchByUser(user.id);
    const active = memberships.filter((membership) => membership.isActive());
    const found = await Promise.all(active.map((membership) => this.tenants.find(membership.tenantId)));

    return found
      .filter((tenant): tenant is Tenant => tenant !== null && tenant.isActive())
      .map((tenant) => {
        const primitives = tenant.toPrimitives();

        return { id: primitives.id, name: primitives.name, slug: primitives.slug };
      });
  }
}
