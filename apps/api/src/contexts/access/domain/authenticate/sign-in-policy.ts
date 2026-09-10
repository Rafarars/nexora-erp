import { InactiveMembershipError } from '../errors/inactive-membership.error.js';
import { InactiveTenantError } from '../errors/inactive-tenant.error.js';
import { InactiveUserError } from '../errors/inactive-user.error.js';
import { Membership } from '../membership/membership.entity.js';
import { Tenant } from '../tenant/tenant.entity.js';
import { User } from '../user/user.entity.js';

// Las tres condiciones para entrar a una empresa, en un solo sitio: iniciar sesion y
// cambiar de empresa comparten la regla, y separarlas invitaria a que divergieran.
export class SignInPolicy {
  static ensureCanSignIn(user: User, tenant: Tenant, membership: Membership): void {
    if (!user.isActive()) {
      throw new InactiveUserError(user.id.value);
    }

    if (!tenant.isActive()) {
      throw new InactiveTenantError(tenant.id.value);
    }

    if (!membership.isActive()) {
      throw new InactiveMembershipError(membership.userId.value, membership.tenantId.value);
    }
  }
}
