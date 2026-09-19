import { Membership } from '../membership/membership.entity.js';
import { MembershipId } from '../membership/membership-id.vo.js';
import { PermissionCode } from '../role/permission-code.vo.js';
import { Role } from '../role/role.entity.js';
import { RoleId } from '../role/role-id.vo.js';
import { RoleName } from '../role/role-name.vo.js';
import { TenantId } from '../tenant/tenant-id.vo.js';
import { TenantName } from '../tenant/tenant-name.vo.js';
import { TenantSlug } from '../tenant/tenant-slug.vo.js';
import { Tenant } from '../tenant/tenant.entity.js';
import { Email } from '../user/email.vo.js';
import { PasswordHash } from '../user/password-hash.vo.js';
import { UserId } from '../user/user-id.vo.js';
import { UserName } from '../user/user-name.vo.js';
import { User } from '../user/user.entity.js';

// Object mothers: las pruebas dicen SOLO lo que les importa y el resto queda en
// valores validos por defecto. Se reutilizan en aplicacion y en las de contrato.
export const NOW = new Date('2026-01-15T10:00:00.000Z');

export const TENANT_A = '11111111-1111-4111-8111-111111111111';
export const TENANT_B = '22222222-2222-4222-8222-222222222222';
export const USER_A = '33333333-3333-4333-8333-333333333333';
export const ROLE_A = '44444444-4444-4444-8444-444444444444';
export const MEMBERSHIP_A = '55555555-5555-4555-8555-555555555555';
// Quien hace el cambio en las pruebas de aplicacion: administra, asi que nada de lo que
// reparte queda fuera de su alcance. Las reglas que se prueban no son las suyas.
export const ACTOR = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const ACTOR_ROLE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const ACTOR_MEMBERSHIP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export const VALID_HASH = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$aGFzaGVkdmFsdWU';

export function aTenant(
  overrides: { id?: string; name?: string; slug?: string; active?: boolean } = {},
): Tenant {
  const tenant = Tenant.create(
    TenantId.of(overrides.id ?? TENANT_A),
    TenantName.of(overrides.name ?? 'Acme'),
    TenantSlug.of(overrides.slug ?? 'acme'),
    NOW,
  );

  if (overrides.active === false) {
    tenant.suspend(NOW);
  }

  return tenant;
}

export function aUser(overrides: { id?: string; email?: string; active?: boolean } = {}): User {
  const user = User.create(
    UserId.of(overrides.id ?? USER_A),
    Email.of(overrides.email ?? 'ana@acme.com'),
    PasswordHash.of(VALID_HASH),
    UserName.of('Ana'),
    NOW,
  );

  if (overrides.active === false) {
    user.deactivate(NOW);
  }

  return user;
}

export function aMembership(
  overrides: {
    id?: string;
    tenantId?: string;
    userId?: string;
    roleIds?: string[];
    active?: boolean;
  } = {},
): Membership {
  const membership = Membership.create(
    MembershipId.of(overrides.id ?? MEMBERSHIP_A),
    UserId.of(overrides.userId ?? USER_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    (overrides.roleIds ?? []).map((id) => RoleId.of(id)),
    NOW,
  );

  if (overrides.active === false) {
    membership.revoke(NOW);
  }

  return membership;
}

export function aRole(
  overrides: { id?: string; tenantId?: string; name?: string; permissions?: string[] } = {},
): Role {
  return Role.create(
    RoleId.of(overrides.id ?? ROLE_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    RoleName.of(overrides.name ?? 'Sales'),
    (overrides.permissions ?? []).map((code) => PermissionCode.of(code)),
    NOW,
  );
}

export function anAdminRole(
  overrides: { id?: string; tenantId?: string; name?: string } = {},
): Role {
  return Role.createAdmin(
    RoleId.of(overrides.id ?? ROLE_A),
    TenantId.of(overrides.tenantId ?? TENANT_A),
    RoleName.of(overrides.name ?? 'Administrator'),
    NOW,
  );
}

// Quien actua SIN administrar: tiene el permiso puntual y nada mas. Sirve para probar lo
// que pasa cuando el ultimo administrador es OTRA persona.
export function anActingSupervisor(permissions: string[] = ['access.users.update'], tenantId = TENANT_A) {
  return {
    user: aUser({ id: ACTOR, email: 'actor@acme.com' }),
    role: aRole({ id: ACTOR_ROLE, tenantId, name: 'Supervisor', permissions }),
    membership: aMembership({
      id: ACTOR_MEMBERSHIP,
      userId: ACTOR,
      tenantId,
      roleIds: [ACTOR_ROLE],
    }),
  };
}

// El administrador que actua, listo para meter en el seed de un escenario. Los ids del rol
// y de la membresia cambian con la empresa: el mismo actor puede administrar dos, y con
// ids repetidos la segunda pisaria a la primera en los dobles.
export function anActingAdministrator(tenantId = TENANT_A) {
  const suffix = tenantId === TENANT_A ? 'd' : 'b';

  return {
    user: aUser({ id: ACTOR, email: 'actor@acme.com' }),
    role: anAdminRole({ id: ACTOR_ROLE.replaceAll('d', suffix), tenantId }),
    membership: aMembership({
      id: ACTOR_MEMBERSHIP.replaceAll('c', suffix),
      userId: ACTOR,
      tenantId,
      roleIds: [ACTOR_ROLE.replaceAll('d', suffix)],
    }),
  };
}
