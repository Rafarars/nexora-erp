import { describe, expect, it } from 'vitest';
import { RoleRevoker } from './role-revoker.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import { CannotDropOwnAdminRoleError } from '../../domain/errors/cannot-drop-own-admin-role.error.js';
import { LastAdministratorError } from '../../domain/errors/last-administrator.error.js';
import {
  ROLE_A,
  TENANT_A,
  USER_A,
  aMembership,
  aRole,
  aTenant,
  aUser,
  anAdminRole,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
// Quien revoca: un administrador actuando sobre otra persona.
const ACTOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function revokerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleRevoker(
    scenario.membershipFinder,
    scenario.roleFinder,
    scenario.memberships,
    scenario.administration,
    scenario.clock,
  );
}

async function rolesOf(scenario: ReturnType<typeof anAccessScenario>): Promise<string[]> {
  const membership = await scenario.memberships.findByUser(
    TenantId.of(TENANT_A),
    UserId.of(USER_A),
  );

  return membership!.roles().map((role) => role.value);
}

describe('RoleRevoker', () => {
  it('takes the role away from the person', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [aRole()],
      memberships: [aMembership({ roleIds: [ROLE_A] })],
    });

    await revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([]);
  });

  it('leaves the other roles alone', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [aRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
      memberships: [aMembership({ roleIds: [ROLE_A, OTHER_ROLE] })],
    });

    await revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([OTHER_ROLE]);
  });

  // Quitar dos veces el mismo rol deja el mismo resultado: la interfaz puede reintentar.
  it('is idempotent', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [aRole()],
      memberships: [aMembership({ roleIds: [ROLE_A] })],
    });
    const revoker = revokerFor(scenario);

    await revoker.run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A });
    await revoker.run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([]);
  });

  it('rejects a person with no membership in the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], roles: [aRole()] });

    await expect(
      revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A }),
    ).rejects.toThrow(MembershipNotFoundError);
  });

  it('rejects a role that does not exist in the tenant', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      memberships: [aMembership()],
    });

    await expect(
      revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A }),
    ).rejects.toThrow(RoleNotFoundError);
  });

  // Esta ruta hacia lo mismo que editar a la persona y no comprobaba nada: se podia quitar
  // por aqui la administracion que por la otra puerta estaba protegida.
  describe('the last administrator', () => {
    const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const OTHER_MEMBERSHIP = '77777777-7777-4777-8777-777777777777';

    function withAdministrators(count: number) {
      return anAccessScenario({
        users: count > 1 ? [aUser(), aUser({ id: OTHER_USER, email: 'beto@acme.com' })] : [aUser()],
        tenants: [aTenant()],
        roles: [anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
        memberships:
          count > 1
            ? [
                aMembership({ roleIds: [ROLE_A] }),
                aMembership({ id: OTHER_MEMBERSHIP, userId: OTHER_USER, roleIds: [ROLE_A] }),
              ]
            : [aMembership({ roleIds: [ROLE_A] })],
      });
    }

    it('refuses to take the administrator role from the only one left', async () => {
      const scenario = withAdministrators(1);

      await expect(
        revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A }),
      ).rejects.toThrow(LastAdministratorError);

      expect(await rolesOf(scenario)).toEqual([ROLE_A]);
    });

    it('allows it while somebody else still administers', async () => {
      const scenario = withAdministrators(2);

      await revokerFor(scenario).run({ tenantId: TENANT_A, actorId: ACTOR, userId: USER_A, roleId: ROLE_A });

      expect(await rolesOf(scenario)).toEqual([]);
    });

    // La misma razon que por la otra puerta, y merece el mismo mensaje.
    it('refuses to let someone take away their own administrator role', async () => {
      const scenario = withAdministrators(2);

      await expect(
        revokerFor(scenario).run({ tenantId: TENANT_A, actorId: USER_A, userId: USER_A, roleId: ROLE_A }),
      ).rejects.toThrow(CannotDropOwnAdminRoleError);
    });

    // Un rol que no administra no deja hueco, aunque sea el unico administrador.
    it('does not get in the way of revoking an ordinary role', async () => {
      const scenario = anAccessScenario({
        users: [aUser()],
        tenants: [aTenant()],
        roles: [anAdminRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
        memberships: [aMembership({ roleIds: [ROLE_A, OTHER_ROLE] })],
      });

      await revokerFor(scenario).run({
        tenantId: TENANT_A,
        actorId: ACTOR,
        userId: USER_A,
        roleId: OTHER_ROLE,
      });

      expect(await rolesOf(scenario)).toEqual([ROLE_A]);
    });
  });
});
