import { describe, expect, it } from 'vitest';
import { RoleRevoker } from './role-revoker.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import {
  ROLE_A,
  TENANT_A,
  USER_A,
  aMembership,
  aRole,
  aTenant,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';

function revokerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleRevoker(
    scenario.membershipFinder,
    scenario.roleFinder,
    scenario.memberships,
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

    await revokerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([]);
  });

  it('leaves the other roles alone', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      roles: [aRole(), aRole({ id: OTHER_ROLE, name: 'Compras' })],
      memberships: [aMembership({ roleIds: [ROLE_A, OTHER_ROLE] })],
    });

    await revokerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });

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

    await revoker.run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });
    await revoker.run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([]);
  });

  it('rejects a person with no membership in the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], roles: [aRole()] });

    await expect(
      revokerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A }),
    ).rejects.toThrow(MembershipNotFoundError);
  });

  it('rejects a role that does not exist in the tenant', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant()],
      memberships: [aMembership()],
    });

    await expect(
      revokerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A }),
    ).rejects.toThrow(RoleNotFoundError);
  });
});
