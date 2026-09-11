import { describe, expect, it } from 'vitest';
import { RoleAssigner } from './role-assigner.js';
import { MembershipNotFoundError } from '../../domain/errors/membership-not-found.error.js';
import { RoleNotFoundError } from '../../domain/errors/role-not-found.error.js';
import { TenantId } from '../../domain/tenant/tenant-id.vo.js';
import { UserId } from '../../domain/user/user-id.vo.js';
import {
  ROLE_A,
  TENANT_A,
  TENANT_B,
  USER_A,
  aMembership,
  aRole,
  aTenant,
} from '../../domain/testing/access.mother.js';
import { anAccessScenario } from '../testing/access-scenario.js';

const OTHER_ROLE = '88888888-8888-4888-8888-888888888888';
const ABSENT = '99999999-9999-4999-8999-999999999999';

function assignerFor(scenario: ReturnType<typeof anAccessScenario>) {
  return new RoleAssigner(
    scenario.membershipFinder,
    scenario.roleFinder,
    scenario.memberships,
    scenario.clock,
  );
}

function aScenario() {
  return anAccessScenario({
    tenants: [aTenant()],
    roles: [aRole()],
    memberships: [aMembership()],
  });
}

async function rolesOf(scenario: ReturnType<typeof anAccessScenario>): Promise<string[]> {
  const membership = await scenario.memberships.findByUser(
    TenantId.of(TENANT_A),
    UserId.of(USER_A),
  );

  return membership!.roles().map((role) => role.value);
}

describe('RoleAssigner', () => {
  it('assigns the role and persists it', async () => {
    const scenario = aScenario();

    await assignerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([ROLE_A]);
  });

  it('is idempotent: assigning twice leaves one role', async () => {
    const scenario = aScenario();
    const assigner = assignerFor(scenario);

    await assigner.run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });
    await assigner.run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A });

    expect(await rolesOf(scenario)).toEqual([ROLE_A]);
  });

  // El aislamiento no depende de que este caso de uso se acuerde de comprobarlo: el
  // repositorio filtra por empresa y el rol ajeno llega como inexistente.
  it('rejects a role of another tenant, as if it did not exist', async () => {
    const scenario = anAccessScenario({
      tenants: [aTenant(), aTenant({ id: TENANT_B, name: 'Globex', slug: 'globex' })],
      roles: [aRole({ id: OTHER_ROLE, tenantId: TENANT_B })],
      memberships: [aMembership()],
    });

    await expect(
      assignerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: OTHER_ROLE }),
    ).rejects.toThrow(RoleNotFoundError);

    expect(await rolesOf(scenario)).toEqual([]);
  });

  it('rejects a user with no membership in the tenant', async () => {
    const scenario = anAccessScenario({ tenants: [aTenant()], roles: [aRole()] });

    await expect(
      assignerFor(scenario).run({ tenantId: TENANT_A, userId: USER_A, roleId: ROLE_A }),
    ).rejects.toThrow(MembershipNotFoundError);
  });

  it('rejects a role that does not exist', async () => {
    await expect(
      assignerFor(aScenario()).run({ tenantId: TENANT_A, userId: USER_A, roleId: ABSENT }),
    ).rejects.toThrow(RoleNotFoundError);
  });
});
